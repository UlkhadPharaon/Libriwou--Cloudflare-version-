export type TaxRegime = 'CME' | 'RSI' | 'RNI' | 'UNKNOWN';

export interface TaxCalculation {
  regime: TaxRegime;
  tvaAmount: number;
  isAmount: number;
  cmeAmount: number;
  totalPayrollCost: number;
  netIncome: number;
}

export interface PayrollCalculation {
  grossSalary: number;
  cnssEmployee: number;
  iuts: number;
  netSalary: number;
  cnssEmployer: number;
  totalEmployerCost: number;
}

// Burkina Faso Tax Constants
const TVA_RATE = 0.18; // 18%
const IS_RATE = 0.275; // 27.5%
const CME_RATE_SERVICES = 0.05; // 5% example for CME services
const CME_RATE_GOODS = 0.02; // 2% example for CME goods

// Payroll Constants
const CNSS_EMPLOYEE_RATE = 0.055; // 5.5%
const CNSS_EMPLOYER_RATE = 0.16; // 16% charges patronales
const CNSS_FAMILY_RATE = 0.035; // 3.5% prestations familiales

export function calculatePayroll(grossSalary: number): PayrollCalculation {
  // CNSS Calculations
  const cnssEmployee = grossSalary * CNSS_EMPLOYEE_RATE;
  const cnssEmployerBase = grossSalary * CNSS_EMPLOYER_RATE;
  const cnssFamily = grossSalary * CNSS_FAMILY_RATE;
  const cnssEmployerTotal = cnssEmployerBase + cnssFamily; // 19.5%
  
  // IUTS Base: Gross - CNSS Employee
  const iutsBase = Math.max(0, grossSalary - cnssEmployee);
  
  // Barème progressif IUTS BF (simplifié 0 à 25%)
  let iuts = 0;
  if (iutsBase > 250000) {
    iuts += (iutsBase - 250000) * 0.25;
    iuts += (250000 - 170000) * 0.216;
    iuts += (170000 - 120000) * 0.184;
    iuts += (120000 - 80000) * 0.157;
    iuts += (80000 - 50000) * 0.139;
    iuts += (50000 - 30000) * 0.121;
  } else if (iutsBase > 170000) {
    iuts += (iutsBase - 170000) * 0.216;
    iuts += (170000 - 120000) * 0.184;
    iuts += (120000 - 80000) * 0.157;
    iuts += (80000 - 50000) * 0.139;
    iuts += (50000 - 30000) * 0.121;
  } else if (iutsBase > 120000) {
    iuts += (iutsBase - 120000) * 0.184;
    iuts += (120000 - 80000) * 0.157;
    iuts += (80000 - 50000) * 0.139;
    iuts += (50000 - 30000) * 0.121;
  } else if (iutsBase > 80000) {
    iuts += (iutsBase - 80000) * 0.157;
    iuts += (80000 - 50000) * 0.139;
    iuts += (50000 - 30000) * 0.121;
  } else if (iutsBase > 50000) {
    iuts += (iutsBase - 50000) * 0.139;
    iuts += (50000 - 30000) * 0.121;
  } else if (iutsBase > 30000) {
    iuts += (iutsBase - 30000) * 0.121;
  }

  const netSalary = grossSalary - cnssEmployee - iuts;
  const totalEmployerCost = grossSalary + cnssEmployerTotal;

  return {
    grossSalary,
    cnssEmployee,
    iuts,
    netSalary,
    cnssEmployer: cnssEmployerTotal,
    totalEmployerCost
  };
}

export function determineTaxRegime(annualRevenue: number): TaxRegime {
  if (annualRevenue < 15_000_000) {
    return 'CME'; // Contribution des Micro-Entreprises
  } else if (annualRevenue >= 15_000_000 && annualRevenue <= 50_000_000) {
    return 'RSI'; // Régime Simplifié d'Imposition
  } else if (annualRevenue > 50_000_000) {
    return 'RNI'; // Régime Réel Normal d'Imposition
  }
  return 'UNKNOWN';
}

export function calculateTaxes(
  revenue: number,
  expenses: number, // Dépenses globales (hors masse salariale brute isolée si on la passe dans grossPayroll)
  regime: TaxRegime,
  isService: boolean = true,
  monthsActive: number = 12,
  grossPayroll: number = 0 // Masse salariale brute annuelle
): TaxCalculation {
  let tvaAmount = 0;
  let isAmount = 0;
  let cmeAmount = 0;
  
  // Calculate payroll costs
  const payrollCalc = calculatePayroll(grossPayroll);
  const totalPayrollCost = payrollCalc.totalEmployerCost;

  // Calculate prorated revenue/expenses
  const prorata = monthsActive / 12;
  const pRevenue = revenue * prorata;
  // Ajout du coût patronal aux charges déductibles
  const pExpenses = (expenses + totalPayrollCost) * prorata; 
  const profit = Math.max(0, pRevenue - pExpenses);

  if (regime === 'CME') {
    // CME replaces IS and TVA for micro-enterprises
    const cmeRate = isService ? CME_RATE_SERVICES : CME_RATE_GOODS;
    cmeAmount = pRevenue * cmeRate;
  } else if (regime === 'RSI' || regime === 'RNI') {
    // RSI and RNI are subject to TVA and IS
    // TVA collected on revenue minus TVA deductible on expenses
    tvaAmount = (pRevenue * TVA_RATE) - (pExpenses * TVA_RATE);
    
    // IS is calculated as 27.5% of profit, but limited by MFP (Minimum Forfaitaire de Perception)
    // MFP is max(0.5% of Revenue, Plancher) 
    // Planchers: RSI = 300 000 FCFA, RNI = 1 000 000 FCFA
    const calculatedIS = profit * IS_RATE;
    const mfpPlancher = regime === 'RSI' ? 300_000 : 1_000_000;
    const mfpCalc = Math.max(pRevenue * 0.005, mfpPlancher * prorata);
    
    isAmount = Math.max(calculatedIS, pRevenue > 0 ? mfpCalc : 0);
  }

  const totalTaxes = Math.max(0, cmeAmount) + Math.max(0, isAmount);
  const netIncome = profit - totalTaxes;

  return {
    regime,
    tvaAmount: Math.max(0, tvaAmount),
    isAmount: Math.max(0, isAmount),
    cmeAmount: Math.max(0, cmeAmount),
    totalPayrollCost,
    netIncome
  };
}
