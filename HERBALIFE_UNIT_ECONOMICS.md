# Herbalife Product Costs & UMS Unit Economics Reference

> **Source of Truth for Herbalife Product Costs & UMS Pack Economics**  
> Verified against Herbalife India cart orders (>= 100 Volume Points tier, 50% Earn Base Supervisor discount, ₹0 delivery charge).

---

## 1. Product Wholesale Costs (50% Earn Base / >= 100 VP / ₹0 Delivery)

| Product | Size | Retail (MRP) | Earn Base | 50% Discount | You Paid (Excl. Tax/Delivery) | Scoops / Canister | Scoop Weight | Cost per Scoop |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Formula 1 (Strawberry)** | 500g | ₹2,075.00 | ₹1,776.00 | ₹888.00 | **₹1,187.00** | 60 | ~8.3g | ₹19.78 |
| **Formula 1 (Kulfi)** | 750g | ₹3,073.00 | ₹2,628.00 | ₹1,314.00 | **₹1,759.00** | 90 | ~8.3g | **₹19.54** |
| **Dinoshake (Chocolate)** | 200g | ₹1,061.00 | ₹908.00 | ₹454.00 | **₹607.00** | 19 | 10.5g | **₹31.95** |
| **Personalized Protein (PPP)** | 400g | ₹2,366.00 | ₹2,023.00 | ₹1,011.50 | **₹1,354.50** | 66 | ~6.0g | **₹20.52** |
| **ShakeMate** | 500g | ₹621.00 | ₹306.00 | ₹153.00 | **₹468.00** | 37 | ~13.5g | **₹12.65** |
| **Afresh Energy Drink (Ginger)** | 50g | ₹773.00 | ₹662.00 | ₹331.00 | **₹442.00** | 40 | ~1.25g | **₹11.05** |

---

## 2. Daily Consumption Costs by Goal

Every active customer receives **1 Shake** + **1 Hot Drink (Afresh)** daily.

### A. Weight Loss (WL) Recipe
- **Shake**: 3 scoops Formula 1 + 1 scoop Protein + 1 scoop ShakeMate
- **Hot Drink**: 1 scoop Afresh

$$\text{Daily WL Cost} = (3 \times 19.544) + 20.523 + 12.649 + 11.05 = \mathbf{₹102.84\ /\ day}$$

### B. Weight Gain (WG) Recipe
- **Shake**: 2 scoops Formula 1 + 1 scoop Dinoshake + 1 scoop Protein + 1 scoop ShakeMate
- **Hot Drink**: 1 scoop Afresh

$$\text{Daily WG Cost} = (2 \times 19.544) + 31.947 + 20.523 + 12.649 + 11.05 = \mathbf{₹115.25\ /\ day}$$

---

## 3. UMS Pack Profitability Matrix (All 4 Packs for Both Goals)

Both **Weight Loss** and **Weight Gain** customers have access to all 4 standard packs:
- **3-Day Trial Pack**: ₹900 (3 days)
- **26-Day Pack**: ₹5,600 (26 days)
- **30-Day Pack**: ₹6,969 (30 days)
- **90-Day Pack**: ₹15,000 (90 days)

$$\text{Ex-GST Revenue} = \frac{\text{UMS Pack Price}}{1.05}$$
$$\text{Profit (Ex-GST)} = \text{Ex-GST Revenue} - (\text{Daily Cost} \times \text{Days})$$

| Pack | UMS Price | Days | Ex-GST Rev | Goal | Daily Cost | Total Product Cost | Profit (Ex-GST) | Margin (%) |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **3-Day Trial** | ₹900 | 3 | ₹857.14 | 🟢 **Weight Loss** | ₹102.84 | ₹308.52 | **₹548.62** | **61.0%** |
| | | | | 🔵 **Weight Gain** | ₹115.25 | ₹345.75 | **₹511.39** | **56.8%** |
| **26-Day** | ₹5,600 | 26 | ₹5,333.33 | 🟢 **Weight Loss** | ₹102.84 | ₹2,673.84 | **₹2,659.49** | **47.5%** |
| | | | | 🔵 **Weight Gain** | ₹115.25 | ₹2,996.50 | **₹2,336.83** | **41.7%** |
| **30-Day** | ₹6,969 | 30 | ₹6,637.14 | 🟢 **Weight Loss** | ₹102.84 | ₹3,085.20 | **₹3,551.94** | **51.0%** |
| | | | | 🔵 **Weight Gain** | ₹115.25 | ₹3,457.50 | **₹3,179.64** | **45.6%** |
| **90-Day** | ₹15,000 | 90 | ₹14,285.71 | 🟢 **Weight Loss** | ₹102.84 | ₹9,255.60 | **₹5,030.11** | **33.5%** |
| | | | | 🔵 **Weight Gain** | ₹115.25 | ₹10,372.50 | **₹3,913.21** | **26.1%** |

*(Optional Add-on Pack: Hot Drink 30-Day @ ₹1,000 / 30d $\rightarrow$ Afresh only ₹11.05/d $\rightarrow$ Cost ₹331.50 $\rightarrow$ Profit ₹620.88 / 62.1% margin).*

---

## 4. UI Display Requirements
1. **Header Badges**: Display side-by-side in finance dashboard:
   - `🟢 WL Daily Cost: ₹102.84`
   - `🔵 WG Daily Cost: ₹115.25`
2. **Pack Cards**: Display all 4 packs with both Weight Loss and Weight Gain economics.
3. **UMS Customer Tracking**: Dynamically detect `customer.goal` (Gain vs Loss) to apply ₹115.25/d vs ₹102.84/d when tracking individual customer profit.
