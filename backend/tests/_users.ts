export const users = {
  user: {
    username: 'fry',
    password: 'fry',
    access: {
      user: true,
      'inWork:expenseReport': true,
      'inWork:healthCareCost': true,
      'appliedFor:travel': true,
      'appliedFor:advance': true
    }
  },
  admin: { username: 'professor', password: 'professor', access: { user: true, admin: true } },
  travel: {
    username: 'zoidberg',
    password: 'zoidberg',
    access: { user: true, 'examine/travel': true, 'approve/travel': true, 'book/travel': true }
  },
  expenseReport: {
    username: 'leela',
    password: 'leela',
    access: { user: true, 'examine/expenseReport': true, 'book/expenseReport': true }
  },
  healthCareCost: {
    username: 'bender',
    password: 'bender',
    access: { user: true, 'examine/healthCareCost': true, 'approve/advance': true, 'book/healthCareCost': true, 'book/advance': true }
  },
  advance: {
    username: 'bender',
    password: 'bender',
    access: { user: true, 'examine/healthCareCost': true, 'approve/advance': true, 'book/healthCareCost': true, 'book/advance': true }
  }
}
