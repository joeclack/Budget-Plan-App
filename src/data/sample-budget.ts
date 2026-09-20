type SampleBudgetRow = {
  amount: number;
  detail?: string;
  id: string;
  label: string;
};

type SampleBudgetGroup = {
  id: string;
  rows: SampleBudgetRow[];
  subtitle: string;
  title: string;
  total: number;
};

type SampleBudget = {
  allocated: number;
  groups: SampleBudgetGroup[];
  income: number;
  leftToPlan: number;
};

export const sampleBudget: SampleBudget = {
  income: 3420,
  allocated: 2875,
  leftToPlan: 545,
  groups: [
    {
      id: "income",
      title: "Income",
      subtitle: "Money available this month",
      total: 3420,
      rows: [
        {
          id: "salary",
          label: "Salary",
          detail: "Take-home estimate",
          amount: 3420,
        },
      ],
    },
    {
      id: "bills",
      title: "Bills",
      subtitle: "Committed spending",
      total: 1593,
      rows: [
        { id: "rent", label: "Rent", amount: 1100 },
        { id: "car", label: "Car finance", amount: 233 },
        {
          id: "subscriptions",
          label: "Subscriptions",
          detail: "Group total",
          amount: 260,
        },
      ],
    },
    {
      id: "goals",
      title: "Giving & goals",
      subtitle: "Connected to monthly income",
      total: 1282,
      rows: [
        { id: "giving", label: "Giving", detail: "10% of Salary", amount: 342 },
        { id: "savings", label: "Savings", amount: 940 },
      ],
    },
  ],
};
