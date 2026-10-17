//! Table-assignment engine: candidate generation (single, merged and split
//! tables), pluggable strategies, a fairness bound, and wait-time simulation.
//! Pure functions; the server feeds it state and staff confirm suggestions.

use serde::{Deserialize, Serialize};
use std::collections::{BTreeMap, HashMap, HashSet};

const MAX_MERGE: usize = 4;
const MINUTE: f64 = 60_000.0;

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct SplitPart {
    pub suffix: String,
    pub seats: u32,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Table {
    pub id: String,
    pub label: String,
    pub seats_min: u32,
    pub seats_max: u32,
    #[serde(default)]
    pub merge_group: Option<String>,
    #[serde(default)]
    pub split_config: Option<Vec<SplitPart>>,
    #[serde(default)]
    pub parent_id: Option<String>,
    pub status: String,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Ticket {
    pub id: String,
    pub number: String,
    pub category: String,
    pub party_size: u32,
    pub created_at: f64,
    #[serde(default)]
    pub skips: u32,
    #[serde(default)]
    pub priority: u32,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Booking {
    pub table_ids: Vec<String>,
    pub slot_start: f64,
}

#[derive(Debug, Clone, Copy, Deserialize, Serialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum Strategy {
    Fifo,
    CategoryFifo,
    BestFit,
    Smart,
}

#[derive(Debug, Clone, Copy, Deserialize, Serialize)]
pub struct Weights {
    pub wait: f64,
    pub waste: f64,
    pub merge: f64,
    pub booking: f64,
    pub priority: f64,
}

impl Default for Weights {
    fn default() -> Self {
        Weights { wait: 1.0, waste: 0.6, merge: 1.5, booking: 3.0, priority: 5.0 }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum Action {
    Seat,
    SplitSeat,
    MergeSeat,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct SplitPlan {
    pub parent_id: String,
    pub child_suffixes: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Candidate {
    pub table_ids: Vec<String>,
    pub labels: Vec<String>,
    pub capacity: u32,
    pub action: Action,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub split: Option<SplitPlan>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Suggestion {
    pub ticket_id: String,
    pub ticket_number: String,
    pub party_size: u32,
    pub table_ids: Vec<String>,
    pub table_labels: Vec<String>,
    pub action: Action,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub split: Option<SplitPlan>,
    pub score: f64,
    pub reasons: Vec<String>,
}

/// Predicted turn minutes per party size; the caller precomputes it from the turn model.
#[derive(Debug, Clone, Default)]
pub struct TurnTable(pub BTreeMap<u32, f64>);

impl<'de> Deserialize<'de> for TurnTable {
    // JSON object keys are strings; parse them explicitly (works under `#[serde(flatten)]` too).
    fn deserialize<D: serde::Deserializer<'de>>(d: D) -> Result<Self, D::Error> {
        let raw = BTreeMap::<String, f64>::deserialize(d)?;
        raw.into_iter()
            .map(|(k, v)| k.parse::<u32>().map(|k| (k, v)).map_err(serde::de::Error::custom))
            .collect::<Result<_, _>>()
            .map(TurnTable)
    }
}

impl TurnTable {
    pub fn minutes(&self, party: u32) -> f64 {
        if let Some(m) = self.0.get(&party) {
            return *m;
        }
        // nearest known size, else the model's prior
        self.0
            .iter()
            .min_by_key(|(k, _)| (**k as i64 - party as i64).abs())
            .map(|(_, v)| *v)
            .unwrap_or_else(|| crate::turn::prior_minutes(party))
    }
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EngineInput {
    pub tables: Vec<Table>,
    pub tickets: Vec<Ticket>,
    #[serde(default)]
    pub bookings: Vec<Booking>,
    pub strategy: Strategy,
    #[serde(default)]
    pub weights: Weights,
    #[serde(default = "default_max_skips")]
    pub max_skips: u32,
    pub now: f64,
    #[serde(default)]
    pub turn: TurnTable,
}

fn default_max_skips() -> u32 {
    3
}

fn fits_single(t: &Table, p: u32) -> bool {
    p >= t.seats_min && p <= t.seats_max
}

fn natural_cmp(a: &str, b: &str) -> std::cmp::Ordering {
    // compare "T2" < "T10": split into (prefix, number)
    let split = |s: &str| {
        let pos = s.find(|c: char| c.is_ascii_digit()).unwrap_or(s.len());
        let (p, n) = s.split_at(pos);
        (p.to_string(), n.parse::<u64>().unwrap_or(0), s.to_string())
    };
    split(a).cmp(&split(b))
}

/// All ways to seat a party of `p` using the given free tables.
pub fn candidates_for(p: u32, free: &[&Table]) -> Vec<Candidate> {
    let mut out = Vec::new();
    for t in free {
        if fits_single(t, p) {
            out.push(Candidate { table_ids: vec![t.id.clone()], labels: vec![t.label.clone()], capacity: t.seats_max, action: Action::Seat, split: None });
        }
        if let Some(cfg) = &t.split_config {
            if cfg.len() > 1 && t.parent_id.is_none() && p < t.seats_max {
                let mut fitting: Vec<&SplitPart> = cfg.iter().filter(|c| c.seats >= p).collect();
                fitting.sort_by_key(|c| c.seats);
                if let Some(child) = fitting.first() {
                    out.push(Candidate {
                        table_ids: vec![t.id.clone()],
                        labels: vec![format!("{}{}", t.label, child.suffix)],
                        capacity: child.seats,
                        action: Action::SplitSeat,
                        split: Some(SplitPlan { parent_id: t.id.clone(), child_suffixes: vec![child.suffix.clone()] }),
                    });
                }
            }
        }
    }
    let mut groups: BTreeMap<&str, Vec<&Table>> = BTreeMap::new();
    for t in free {
        if let Some(g) = &t.merge_group {
            groups.entry(g.as_str()).or_default().push(t);
        }
    }
    for tables in groups.values_mut() {
        if tables.len() < 2 {
            continue;
        }
        tables.sort_by(|a, b| natural_cmp(&a.label, &b.label));
        let mut combos: Vec<Vec<&Table>> = Vec::new();
        fn rec<'a>(src: &[&'a Table], start: usize, acc: &mut Vec<&'a Table>, out: &mut Vec<Vec<&'a Table>>) {
            if acc.len() >= 2 {
                out.push(acc.clone());
            }
            if acc.len() == MAX_MERGE {
                return;
            }
            for i in start..src.len() {
                acc.push(src[i]);
                rec(src, i + 1, acc, out);
                acc.pop();
            }
        }
        rec(tables, 0, &mut Vec::new(), &mut combos);
        for c in combos {
            let cap: u32 = c.iter().map(|t| t.seats_max).sum();
            if cap < p {
                continue;
            }
            if c.iter().any(|t| cap - t.seats_max >= p) {
                continue; // not minimal
            }
            if c.iter().any(|t| fits_single(t, p)) {
                continue; // a single table of the group already works
            }
            out.push(Candidate {
                table_ids: c.iter().map(|t| t.id.clone()).collect(),
                labels: c.iter().map(|t| t.label.clone()).collect(),
                capacity: cap,
                action: Action::MergeSeat,
                split: None,
            });
        }
    }
    out
}

fn booking_gap_minutes(c: &Candidate, bookings: &[Booking], now: f64) -> Option<f64> {
    let mut gap: Option<f64> = None;
    for b in bookings {
        if b.slot_start < now - 15.0 * MINUTE {
            continue;
        }
        if b.table_ids.iter().any(|id| c.table_ids.contains(id)) {
            let g = (b.slot_start - now) / MINUTE;
            gap = Some(gap.map_or(g, |x: f64| x.min(g)));
        }
    }
    gap
}

pub fn score_candidate(t: &Ticket, c: &Candidate, input: &EngineInput) -> (f64, Vec<String>) {
    let w = &input.weights;
    let wait = ((input.now - t.created_at) / MINUTE).max(0.0);
    let mut reasons = vec![format!("waiting {} min", wait.round() as i64)];
    let mut score = w.wait * (wait + 0.02 * wait * wait);
    let waste = c.capacity.saturating_sub(t.party_size);
    score -= w.waste * waste as f64 * 3.0;
    reasons.push(if waste == 0 { "perfect fit".into() } else { format!("{} empty seat{}", waste, if waste > 1 { "s" } else { "" }) });
    match c.action {
        Action::MergeSeat => {
            score -= w.merge * 5.0 * (c.table_ids.len() as f64 - 1.0);
            reasons.push(format!("merges {}", c.labels.join("+")));
        }
        Action::SplitSeat => {
            score -= w.merge * 3.0;
            reasons.push("splits table to free the other half".into());
        }
        Action::Seat => {}
    }
    if t.priority > 0 {
        score += w.priority * 10.0 * t.priority as f64;
        reasons.push("priority guest".into());
    }
    if t.skips > 0 {
        reasons.push(format!("skipped {}×", t.skips));
    }
    if let Some(gap) = booking_gap_minutes(c, &input.bookings, input.now) {
        let turn = input.turn.minutes(t.party_size);
        if gap < turn {
            score -= w.booking * (turn - gap) / 5.0;
            reasons.push(format!("booking on this table in {} min", gap.max(0.0).round() as i64));
        }
    }
    ((score * 100.0).round() / 100.0, reasons)
}

fn action_rank(a: Action) -> u8 {
    match a {
        Action::Seat => 0,
        Action::SplitSeat => 1,
        Action::MergeSeat => 2,
    }
}

/// Simplest seating first (single > split > merge), then least waste.
fn preference(a: &Candidate, b: &Candidate) -> std::cmp::Ordering {
    action_rank(a.action).cmp(&action_rank(b.action)).then(a.capacity.cmp(&b.capacity))
}

struct Picker<'a> {
    input: &'a EngineInput,
    free: Vec<&'a Table>,
    used: HashSet<String>,
    out: Vec<Suggestion>,
}

impl<'a> Picker<'a> {
    fn avail(&self) -> Vec<&'a Table> {
        self.free.iter().copied().filter(|t| !self.used.contains(&t.id)).collect()
    }
    fn best(&self, t: &Ticket) -> Option<Candidate> {
        let mut c = candidates_for(t.party_size, &self.avail());
        c.sort_by(preference);
        c.into_iter().next()
    }
    fn take(&mut self, t: &Ticket, c: Candidate, why: Option<String>) {
        for id in &c.table_ids {
            self.used.insert(id.clone());
        }
        let (score, mut reasons) = score_candidate(t, &c, self.input);
        if let Some(w) = why {
            reasons.insert(0, w);
        }
        self.out.push(Suggestion {
            ticket_id: t.id.clone(),
            ticket_number: t.number.clone(),
            party_size: t.party_size,
            table_ids: c.table_ids,
            table_labels: c.labels,
            action: c.action,
            split: c.split,
            score,
            reasons,
        });
    }
}

/// Produce seating suggestions according to the configured strategy.
pub fn suggest(input: &EngineInput) -> Vec<Suggestion> {
    let free: Vec<&Table> = input.tables.iter().filter(|t| t.status == "free").collect();
    let mut tickets: Vec<&Ticket> = input.tickets.iter().collect();
    tickets.sort_by(|a, b| a.created_at.partial_cmp(&b.created_at).unwrap());
    let mut pk = Picker { input, free, used: HashSet::new(), out: Vec::new() };

    match input.strategy {
        Strategy::Fifo => {
            for t in tickets {
                match pk.best(t) {
                    Some(c) => pk.take(t, c, Some("strict first-come-first-served".into())),
                    None => break, // nobody overtakes the head of the line
                }
            }
            pk.out
        }
        Strategy::CategoryFifo => {
            // round-robin over the heads of each size class so one class can't starve another
            let mut lines: BTreeMap<&str, std::collections::VecDeque<&Ticket>> = BTreeMap::new();
            for t in &tickets {
                lines.entry(t.category.as_str()).or_default().push_back(t);
            }
            let mut blocked: HashSet<&str> = HashSet::new();
            loop {
                let mut heads: Vec<&Ticket> = lines.iter().filter(|(c, l)| !l.is_empty() && !blocked.contains(*c)).map(|(_, l)| *l.front().unwrap()).collect();
                if heads.is_empty() {
                    break;
                }
                heads.sort_by(|a, b| a.created_at.partial_cmp(&b.created_at).unwrap());
                for t in heads {
                    lines.get_mut(t.category.as_str()).unwrap().pop_front();
                    match pk.best(t) {
                        Some(c) => pk.take(t, c, Some(format!("first in line for {}", t.category))),
                        None => {
                            blocked.insert(t.category.as_str());
                        }
                    }
                }
            }
            pk.out
        }
        Strategy::BestFit | Strategy::Smart => {
            // fairness pre-pass: tickets skipped too often are served first
            let mut held: Vec<u32> = Vec::new();
            let mut starved_ids: HashSet<&str> = HashSet::new();
            for t in tickets.iter().filter(|t| t.skips >= input.max_skips) {
                starved_ids.insert(t.id.as_str());
                match pk.best(t) {
                    Some(c) => pk.take(t, c, Some(format!("fairness: skipped {}× already", t.skips))),
                    None => held.push(t.party_size),
                }
            }
            let min_held = held.iter().copied().min();
            struct Pair<'b> {
                t: &'b Ticket,
                c: Candidate,
                score: f64,
                waste: u32,
            }
            let mut pairs: Vec<Pair> = Vec::new();
            for t in tickets.iter().filter(|t| !starved_ids.contains(t.id.as_str())) {
                for c in candidates_for(t.party_size, &pk.avail()) {
                    // a starved ticket that couldn't be seated holds back tables big enough for it
                    if let Some(h) = min_held {
                        if c.capacity >= h && t.party_size < h {
                            continue;
                        }
                    }
                    let score = score_candidate(t, &c, input).0;
                    let waste = c.capacity.saturating_sub(t.party_size);
                    pairs.push(Pair { t, c, score, waste });
                }
            }
            if input.strategy == Strategy::BestFit {
                pairs.sort_by(|a, b| {
                    a.waste
                        .cmp(&b.waste)
                        .then(a.t.created_at.partial_cmp(&b.t.created_at).unwrap())
                        .then(preference(&a.c, &b.c))
                });
            } else {
                pairs.sort_by(|a, b| b.score.partial_cmp(&a.score).unwrap().then(a.t.created_at.partial_cmp(&b.t.created_at).unwrap()));
            }
            let mut seated: HashSet<String> = HashSet::new();
            let why = if input.strategy == Strategy::BestFit { Some("best seat fit".to_string()) } else { None };
            for p in pairs {
                if seated.contains(&p.t.id) || p.c.table_ids.iter().any(|id| pk.used.contains(id)) {
                    continue;
                }
                seated.insert(p.t.id.clone());
                pk.take(p.t, p.c, why.clone());
            }
            pk.out
        }
    }
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BusyTable {
    pub table_ids: Vec<String>,
    pub free_at: f64,
}

/// Estimate minutes until each waiting ticket is seated by replaying the
/// strategy forward in time against predicted table release times.
/// Tickets that can never be seated (no table or merge fits) are absent.
pub fn estimate_waits(input: &EngineInput, busy: &[BusyTable]) -> HashMap<String, i64> {
    let mut etas = HashMap::new();
    let mut tables = input.tables.clone();
    let mut pending = input.tickets.clone();
    let mut releases: Vec<(Vec<String>, f64)> = busy.iter().map(|b| (b.table_ids.clone(), b.free_at.max(input.now + 5.0 * MINUTE))).collect();
    let mut t = input.now;
    for _ in 0..200 {
        if pending.is_empty() {
            break;
        }
        let step = EngineInput { tables: tables.clone(), tickets: pending.clone(), bookings: vec![], now: t, ..input.clone() };
        let sugg = suggest(&step);
        for s in &sugg {
            etas.insert(s.ticket_id.clone(), ((t - input.now) / MINUTE).round() as i64);
            for x in tables.iter_mut() {
                if s.table_ids.contains(&x.id) {
                    x.status = "busy".into();
                }
            }
            releases.push((s.table_ids.clone(), t + input.turn.minutes(s.party_size) * MINUTE));
        }
        let seated: HashSet<&String> = sugg.iter().map(|s| &s.ticket_id).collect();
        pending.retain(|p| !seated.contains(&p.id));
        if pending.is_empty() {
            break;
        }
        let next = releases.iter().filter(|r| r.1 > t && r.1.is_finite()).map(|r| r.1).fold(f64::INFINITY, f64::min);
        if !next.is_finite() {
            break; // nothing will ever free up for the remaining parties
        }
        t = next;
        let freeing: HashSet<String> = releases.iter().filter(|r| r.1 <= t).flat_map(|r| r.0.clone()).collect();
        for x in tables.iter_mut() {
            if freeing.contains(&x.id) && matches!(x.status.as_str(), "busy" | "seated" | "dirty") {
                x.status = "free".into();
            }
        }
        for r in releases.iter_mut() {
            if r.1 <= t {
                r.1 = f64::INFINITY;
            }
        }
    }
    etas
}

#[cfg(test)]
mod tests {
    use super::*;

    const NOW: f64 = 1_792_209_600_000.0;

    fn table(id: &str, seats: u32) -> Table {
        Table { id: id.into(), label: id.into(), seats_min: if seats <= 2 { 1 } else { seats - 2 }, seats_max: seats, merge_group: None, split_config: None, parent_id: None, status: "free".into() }
    }
    fn grouped(id: &str, seats: u32, g: &str) -> Table {
        Table { merge_group: Some(g.into()), ..table(id, seats) }
    }
    fn ticket(id: &str, size: u32, waited: f64) -> Ticket {
        let category = if size <= 2 { "S" } else if size <= 4 { "M" } else { "L" };
        Ticket { id: id.into(), number: id.into(), category: category.into(), party_size: size, created_at: NOW - waited * MINUTE, skips: 0, priority: 0 }
    }
    fn input(tables: Vec<Table>, tickets: Vec<Ticket>, strategy: Strategy) -> EngineInput {
        let turn = TurnTable((1..=30).map(|p| (p, 40.0 + 5.0 * p as f64)).collect());
        EngineInput { tables, tickets, bookings: vec![], strategy, weights: Weights::default(), max_skips: 3, now: NOW, turn }
    }
    fn by_ticket(s: &[Suggestion]) -> HashMap<String, Vec<String>> {
        s.iter().map(|x| (x.ticket_id.clone(), x.table_ids.clone())).collect()
    }

    #[test]
    fn candidates_single_merge_split() {
        let r1 = Table { seats_min: 6, split_config: Some(vec![SplitPart { suffix: "a".into(), seats: 6 }, SplitPart { suffix: "b".into(), seats: 4 }]), ..table("R1", 10) };
        let tables = vec![grouped("T1", 4, "g"), grouped("T2", 4, "g"), grouped("T3", 4, "g"), r1];
        let refs: Vec<&Table> = tables.iter().collect();
        let big = candidates_for(8, &refs);
        assert!(big.iter().any(|c| c.action == Action::Seat && c.table_ids == vec!["R1"]));
        let merges: Vec<_> = big.iter().filter(|c| c.action == Action::MergeSeat).collect();
        assert_eq!(merges.len(), 3);
        assert!(merges.iter().all(|c| c.table_ids.len() == 2));
        let small = candidates_for(3, &refs);
        assert!(small.iter().any(|c| c.action == Action::SplitSeat && c.labels == vec!["R1b"]));
        assert!(candidates_for(30, &[&table("A", 4), &table("B", 4)]).is_empty());
    }

    #[test]
    fn fifo_is_strict() {
        let s = suggest(&input(vec![table("T1", 2)], vec![ticket("A1", 6, 30.0), ticket("A2", 2, 5.0)], Strategy::Fifo));
        assert!(s.is_empty());
    }

    #[test]
    fn category_fifo_round_robin() {
        let s = suggest(&input(
            vec![table("T1", 2), table("T2", 4)],
            vec![ticket("C1", 6, 30.0), ticket("A1", 2, 10.0), ticket("A2", 2, 20.0), ticket("B1", 4, 1.0)],
            Strategy::CategoryFifo,
        ));
        let m = by_ticket(&s);
        assert_eq!(m["A2"], vec!["T1"]);
        assert_eq!(m["B1"], vec!["T2"]);
        assert!(!m.contains_key("C1"));
    }

    #[test]
    fn best_fit_minimises_waste() {
        let t6 = Table { seats_min: 1, ..table("T6", 6) };
        let s = suggest(&input(vec![t6, table("T2", 2)], vec![ticket("A1", 2, 20.0), ticket("C1", 6, 5.0)], Strategy::BestFit));
        let m = by_ticket(&s);
        assert_eq!(m["A1"], vec!["T2"]);
        assert_eq!(m["C1"], vec!["T6"]);
    }

    #[test]
    fn smart_merges_for_big_party() {
        let s = suggest(&input(vec![grouped("T1", 4, "patio"), grouped("T2", 4, "patio")], vec![ticket("C1", 7, 15.0)], Strategy::Smart));
        assert_eq!(s.len(), 1);
        assert_eq!(s[0].action, Action::MergeSeat);
        assert!(s[0].reasons.join(" ").contains("merges T1+T2"));
    }

    #[test]
    fn smart_ages_waiting_parties() {
        let s = suggest(&input(vec![table("T1", 4)], vec![ticket("B1", 4, 5.0), ticket("B2", 4, 40.0)], Strategy::Smart));
        assert_eq!(s.iter().map(|x| x.ticket_id.as_str()).collect::<Vec<_>>(), vec!["B2"]);
    }

    #[test]
    fn smart_avoids_imminent_booking() {
        let mut i = input(vec![table("T1", 4), table("T2", 4)], vec![ticket("B1", 4, 10.0)], Strategy::Smart);
        i.bookings = vec![Booking { table_ids: vec!["T1".into()], slot_start: NOW + 20.0 * MINUTE }];
        assert_eq!(suggest(&i)[0].table_ids, vec!["T2"]);
    }

    #[test]
    fn fairness_bound() {
        let t6 = Table { seats_min: 1, ..table("T6", 6) };
        let starved = Ticket { skips: 3, ..ticket("C1", 6, 50.0) };
        let vip = Ticket { priority: 1, ..ticket("A1", 2, 60.0) };
        let s = suggest(&input(vec![t6], vec![starved.clone(), vip], Strategy::Smart));
        assert_eq!(s.iter().map(|x| x.ticket_id.as_str()).collect::<Vec<_>>(), vec!["C1"]);
        let starved4 = Ticket { skips: 3, ..ticket("C1", 4, 50.0) };
        let held = suggest(&input(vec![table("T4", 4), table("T2", 2)], vec![starved4, ticket("A1", 2, 60.0)], Strategy::Smart));
        assert_eq!(by_ticket(&held)["C1"], vec!["T4"]);
    }

    #[test]
    fn never_double_books() {
        let tables = vec![grouped("T1", 4, "g"), grouped("T2", 4, "g"), table("T3", 2)];
        let tickets = vec![ticket("C1", 8, 30.0), ticket("B1", 4, 29.0), ticket("B2", 3, 28.0), ticket("A1", 2, 27.0)];
        for st in [Strategy::Fifo, Strategy::CategoryFifo, Strategy::BestFit, Strategy::Smart] {
            let s = suggest(&input(tables.clone(), tickets.clone(), st));
            let ids: Vec<&String> = s.iter().flat_map(|x| &x.table_ids).collect();
            let uniq: HashSet<&&String> = ids.iter().collect();
            assert_eq!(uniq.len(), ids.len(), "{st:?}");
        }
    }

    #[test]
    fn eta_simulation() {
        let mut t2 = table("T2", 2);
        t2.status = "seated".into();
        let i = input(vec![table("T1", 2), t2], vec![ticket("A1", 2, 10.0), ticket("A2", 2, 5.0), ticket("A3", 2, 1.0)], Strategy::Smart);
        let etas = estimate_waits(&i, &[BusyTable { table_ids: vec!["T2".into()], free_at: NOW + 20.0 * MINUTE }]);
        assert_eq!(etas["A1"], 0);
        assert_eq!(etas["A2"], 20);
        assert_eq!(etas["A3"], 50);
        let none = estimate_waits(&input(vec![table("T1", 2)], vec![ticket("X", 20, 1.0)], Strategy::Smart), &[]);
        assert!(!none.contains_key("X"));
    }
}
