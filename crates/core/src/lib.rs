//! Beautifood domain core. The same compiled WASM runs inside the Cloudflare
//! Worker (authoritative) and in the browser (instant UI, offline POS), so a
//! bill or a seating suggestion can never differ between the two.
//!
//! The WASM boundary is JSON strings: every export takes and returns JSON, and
//! errors come back as `{"error": "..."}`.

pub mod assignment;
pub mod money;
pub mod turn;

use serde::Deserialize;
use serde_json::json;
use wasm_bindgen::prelude::*;

fn run<T: for<'de> Deserialize<'de>, R: serde::Serialize>(input: &str, f: impl FnOnce(T) -> Result<R, String>) -> String {
    match serde_json::from_str::<T>(input) {
        Ok(v) => match f(v) {
            Ok(r) => serde_json::to_string(&r).unwrap_or_else(|e| json!({ "error": e.to_string() }).to_string()),
            Err(e) => json!({ "error": e }).to_string(),
        },
        Err(e) => json!({ "error": format!("invalid input: {e}") }).to_string(),
    }
}

#[wasm_bindgen]
pub fn compute_totals(input: &str) -> String {
    run(input, |p: money::PricingInput| Ok(money::compute_totals(&p)))
}

#[derive(Deserialize)]
struct SplitIn {
    amount: i64,
    n: i64,
}

#[wasm_bindgen]
pub fn split_equally(input: &str) -> String {
    run(input, |s: SplitIn| money::split_equally(s.amount, s.n))
}

#[wasm_bindgen]
pub fn suggest(input: &str) -> String {
    run(input, |i: assignment::EngineInput| Ok(assignment::suggest(&i)))
}

#[derive(Deserialize)]
struct EtaIn {
    #[serde(flatten)]
    engine: assignment::EngineInput,
    #[serde(default)]
    busy: Vec<assignment::BusyTable>,
}

#[wasm_bindgen]
pub fn estimate_waits(input: &str) -> String {
    run(input, |i: EtaIn| Ok(assignment::estimate_waits(&i.engine, &i.busy)))
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct CandidatesIn {
    party_size: u32,
    tables: Vec<assignment::Table>,
}

#[wasm_bindgen]
pub fn candidates_for(input: &str) -> String {
    run(input, |i: CandidatesIn| {
        let free: Vec<&assignment::Table> = i.tables.iter().filter(|t| t.status == "free").collect();
        Ok(assignment::candidates_for(i.party_size, &free))
    })
}

#[derive(Deserialize)]
struct PredictIn {
    model: turn::TurnModel,
    party: u32,
    hour: u32,
    weekend: bool,
}

#[wasm_bindgen]
pub fn predict_turn(input: &str) -> String {
    run(input, |i: PredictIn| Ok(turn::predict(&i.model, i.party, i.hour, i.weekend)))
}

#[derive(Deserialize)]
struct ObserveIn {
    model: turn::TurnModel,
    party: u32,
    hour: u32,
    weekend: bool,
    minutes: f64,
}

#[wasm_bindgen]
pub fn observe_turn(input: &str) -> String {
    run(input, |mut i: ObserveIn| {
        turn::observe(&mut i.model, i.party, i.hour, i.weekend, i.minutes);
        Ok(i.model)
    })
}

#[wasm_bindgen]
pub fn version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}
