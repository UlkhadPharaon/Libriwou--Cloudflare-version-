import { calculateTaxes, determineTaxRegime, TaxRegime } from './tax-rules.js';

interface TestCase {
  revenue: number;
  expenses: number;
  isService: boolean;
  expectedRegime: TaxRegime;
  // Expected values could be added here for precise assertions
}

const testCases: TestCase[] = [
  // CME
  { revenue: 5_000_000, expenses: 2_000_000, isService: true, expectedRegime: 'CME' },
  { revenue: 10_000_000, expenses: 8_000_000, isService: false, expectedRegime: 'CME' },
  
  // RSI
  { revenue: 20_000_000, expenses: 5_000_000, isService: true, expectedRegime: 'RSI' },
  { revenue: 45_000_000, expenses: 30_000_000, isService: false, expectedRegime: 'RSI' },
  
  // RNI
  { revenue: 60_000_000, expenses: 10_000_000, isService: true, expectedRegime: 'RNI' },
  { revenue: 100_000_000, expenses: 70_000_000, isService: false, expectedRegime: 'RNI' },
];

export function runTaxTests() {
  console.log("--- Starting Tax Calculation Tests ---");
  let passed = 0;
  
  testCases.forEach((test, index) => {
    const regime = determineTaxRegime(test.revenue);
    const results = calculateTaxes(test.revenue, test.expenses, regime, test.isService);
    
    const isRegimeCorrect = regime === test.expectedRegime;
    
    if (isRegimeCorrect) {
      console.log(`Test ${index + 1} PASSED: Regime ${regime} correct for revenue ${test.revenue}`);
      passed++;
    } else {
      console.error(`Test ${index + 1} FAILED: Expected ${test.expectedRegime}, got ${regime}`);
    }
  });

  console.log(`--- Tests Complete: ${passed}/${testCases.length} passed ---`);
}

// Execute tests
runTaxTests();
