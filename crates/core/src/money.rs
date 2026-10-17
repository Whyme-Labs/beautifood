//! Bill arithmetic. All amounts are integer minor units (sen / cents).

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Deserialize, Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct Modifier {
    #[serde(default)]
    pub group: String,
    #[serde(default)]
    pub option: String,
    pub price: i64,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PricingLine {
    pub unit_price: i64,
    pub qty: i64,
    #[serde(default)]
    pub modifiers: Vec<Modifier>,
}

#[derive(Debug, Clone, Copy, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum DiscountKind {
    Percent,
    Amount,
}

#[derive(Debug, Clone, Deserialize)]
pub struct Discount {
    pub kind: DiscountKind,
    pub value: f64,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PricingInput {
    pub lines: Vec<PricingLine>,
    #[serde(default)]
    pub discount: Option<Discount>,
    pub service_charge_pct: f64,
    pub tax_pct: f64,
    #[serde(default)]
    pub tax_inclusive: bool,
    #[serde(default = "one")]
    pub cash_rounding: i64,
}

fn one() -> i64 {
    1
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct Totals {
    pub subtotal: i64,
    pub discount: i64,
    pub service_charge: i64,
    pub tax: i64,
    pub rounding: i64,
    pub total: i64,
}

/// Round half away from zero.
pub fn round_minor(x: f64) -> i64 {
    x.round() as i64
}

pub fn line_total(l: &PricingLine) -> i64 {
    let mods: i64 = l.modifiers.iter().map(|m| m.price).sum();
    (l.unit_price + mods) * l.qty
}

/// subtotal → discount → service charge on the discounted subtotal →
/// tax on (discounted + service) → round the grand total to the cash unit.
pub fn compute_totals(p: &PricingInput) -> Totals {
    let subtotal: i64 = p.lines.iter().map(line_total).sum();
    let discount = match &p.discount {
        None => 0,
        Some(d) => match d.kind {
            DiscountKind::Percent => round_minor(subtotal as f64 * d.value.clamp(0.0, 100.0) / 100.0),
            DiscountKind::Amount => round_minor(d.value).clamp(0, subtotal.max(0)),
        },
    };
    let net = subtotal - discount;
    let service_charge = round_minor(net as f64 * p.service_charge_pct / 100.0);
    let tax = if p.tax_inclusive {
        let gross = (net + service_charge) as f64;
        round_minor(gross - gross / (1.0 + p.tax_pct / 100.0))
    } else {
        round_minor((net + service_charge) as f64 * p.tax_pct / 100.0)
    };
    let unrounded = net + service_charge + if p.tax_inclusive { 0 } else { tax };
    let unit = p.cash_rounding.max(1);
    let total = round_minor(unrounded as f64 / unit as f64) * unit;
    Totals { subtotal, discount, service_charge, tax, rounding: total - unrounded, total }
}

/// Split an amount into `n` parts that sum exactly to `amount`; the first parts absorb the remainder.
pub fn split_equally(amount: i64, n: i64) -> Result<Vec<i64>, String> {
    if n < 1 {
        return Err("n must be a positive integer".into());
    }
    let base = amount.div_euclid(n);
    let rem = amount - base * n;
    Ok((0..n).map(|i| base + if i < rem { 1 } else { 0 }).collect())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn input(lines: Vec<(i64, i64, i64)>, discount: Option<Discount>, svc: f64, tax: f64, incl: bool, round: i64) -> PricingInput {
        PricingInput {
            lines: lines
                .into_iter()
                .map(|(unit_price, qty, m)| PricingLine {
                    unit_price,
                    qty,
                    modifiers: if m > 0 { vec![Modifier { group: "Size".into(), option: "Large".into(), price: m }] } else { vec![] },
                })
                .collect(),
            discount,
            service_charge_pct: svc,
            tax_pct: tax,
            tax_inclusive: incl,
            cash_rounding: round,
        }
    }

    #[test]
    fn subtotal_service_tax_rounding() {
        let t = compute_totals(&input(vec![(1290, 2, 0), (450, 1, 100)], None, 10.0, 6.0, false, 5));
        assert_eq!(t.subtotal, 3130);
        assert_eq!(t.service_charge, 313);
        assert_eq!(t.tax, 207);
        assert_eq!(t.total, 3650);
        assert_eq!(t.total % 5, 0);
        assert_eq!(t.rounding, t.total - (3130 + 313 + 207));
    }

    #[test]
    fn discounts_before_service_charge() {
        let pct = compute_totals(&input(vec![(10000, 1, 0)], Some(Discount { kind: DiscountKind::Percent, value: 10.0 }), 10.0, 0.0, false, 1));
        assert_eq!((pct.discount, pct.service_charge, pct.total), (1000, 900, 9900));
        let amt = compute_totals(&input(vec![(500, 1, 0)], Some(Discount { kind: DiscountKind::Amount, value: 99999.0 }), 0.0, 0.0, false, 1));
        assert_eq!((amt.discount, amt.total), (500, 0));
    }

    #[test]
    fn inclusive_tax() {
        let t = compute_totals(&input(vec![(1060, 1, 0)], None, 0.0, 6.0, true, 1));
        assert_eq!((t.total, t.tax), (1060, 60));
    }

    #[test]
    fn split() {
        assert_eq!(split_equally(1000, 3).unwrap(), vec![334, 333, 333]);
        assert_eq!(split_equally(1000, 3).unwrap().iter().sum::<i64>(), 1000);
        assert!(split_equally(10, 0).is_err());
    }
}
