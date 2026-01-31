module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  testRegex: '.*\\.spec\\.ts$',
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest',
  },
  collectCoverageFrom: ['**/*.(t|j)s'],
  coverageDirectory: '../coverage',
  testEnvironment: 'node',
  moduleNameMapper: {
    '^utils/(.*)$': '<rootDir>/../utils/$1',
    '^src/(.*)$': '<rootDir>/../src/$1',
    '^guard$': '<rootDir>/../guard',
    '^guard/(.*)$': '<rootDir>/../guard/$1',
  },
};
