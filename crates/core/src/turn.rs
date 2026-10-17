//! Online-learning dining-duration ("turn time") model.
//!
//! Keyed by party-size bucket × daypart × weekend flag. Each key keeps a running
//! mean that becomes an EWMA once warm, shrunk toward a prior so early
//! predictions are sensible. The caller supplies the branch-local hour and
//! weekend flag (timezone handling stays in JS where `Intl` is available).

use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;

#[derive(Debug, Clone, Copy, Deserialize, Serialize, PartialEq)]
pub struct TurnStat {
    pub mean: f64,
    pub n: u32,
}

pub type TurnModel = BTreeMap<String, TurnStat>;

const PRIOR_WEIGHT: f64 = 3.0;

pub fn size_bucket(party: u32) -> &'static str {
    match party {
        0..=2 => "1-2",
        3..=4 => "3-4",
        5..=6 => "5-6",
        7..=8 => "7-8",
        _ => "9+",
    }
}

pub fn daypart(hour: u32) -> &'static str {
    match hour {
        6..=10 => "breakfast",
        11..=14 => "lunch",
        15..=17 => "tea",
        18..=22 => "dinner",
        _ => "late",
    }
}

pub fn turn_key(party: u32, hour: u32, weekend: bool) -> String {
    format!("{}|{}|{}", size_bucket(party), daypart(hour), if weekend { "we" } else { "wd" })
}

pub fn prior_minutes(party: u32) -> f64 {
    35.0 + 6.0 * party.min(12) as f64
}

pub fn predict(model: &TurnModel, party: u32, hour: u32, weekend: bool) -> f64 {
    let prior = prior_minutes(party);
    match model.get(&turn_key(party, hour, weekend)) {
        Some(s) if s.n > 0 => (prior * PRIOR_WEIGHT + s.mean * s.n as f64) / (PRIOR_WEIGHT + s.n as f64),
        _ => prior,
    }
}

/// Fold one observed seating duration into the model. Junk observations
/// (mis-taps, tables left open overnight) are ignored.
pub fn observe(model: &mut TurnModel, party: u32, hour: u32, weekend: bool, minutes: f64) -> bool {
    if !(minutes > 2.0 && minutes < 600.0) {
        return false;
    }
    let key = turn_key(party, hour, weekend);
    let next = match model.get(&key) {
        None => TurnStat { mean: minutes, n: 1 },
        Some(p) => {
            let alpha = (1.0 / (p.n as f64 + 1.0)).max(0.1);
            TurnStat { mean: p.mean + alpha * (minutes - p.mean), n: (p.n + 1).min(1000) }
        }
    };
    model.insert(key, next);
    true
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn learns_from_prior() {
        let mut m = TurnModel::new();
        assert_eq!(turn_key(2, 12, false), "1-2|lunch|wd");
        assert_eq!(predict(&m, 2, 12, false), prior_minutes(2));
        for _ in 0..30 {
            observe(&mut m, 2, 12, false, 30.0);
        }
        let p = predict(&m, 2, 12, false);
        assert!(p > 29.0 && p < 33.0, "{p}");
        assert!(!observe(&mut m, 2, 12, false, 900.0));
        assert_eq!(predict(&m, 2, 19, true), prior_minutes(2));
    }
}
