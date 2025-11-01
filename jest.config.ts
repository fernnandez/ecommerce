import type { Config } from 'jest';

const config: Config = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  testMatch: ['<rootDir>/test/**/*.spec.ts'],
  transform: {
    '^.+\\.(t|j)s$': [
      'ts-jest',
      {
        tsconfig: 'tsconfig.test.json',
      },
    ],
  },
  moduleNameMapper: {
    '^@src/(.*)$': '<rootDir>/src/$1',
    '^@test/(.*)$': '<rootDir>/test/$1',
    '^@domain/(.*)$': '<rootDir>/src/domain/$1',
    '^@application/(.*)$': '<rootDir>/src/application/$1',
    '^@infra/(.*)$': '<rootDir>/src/infra/$1',
    '^@config/(.*)$': '<rootDir>/src/config/$1',
    '^@integration/(.*)$': '<rootDir>/src/integration/$1',
  },
  collectCoverageFrom: [
    'src/**/*.(t|j)s',
    '!src/**/*.spec.ts',
    '!src/**/*.interface.ts',
    '!src/**/*.dto.ts',
    '!src/**/*.entity.ts',
    '!src/**/*.module.ts',
    '!src/**/main.ts',
    '!src/**/*.config.ts',
    '!src/**/*datasource.ts',
  ],
  coverageDirectory: './coverage',
  coverageReporters: ['text', 'text-summary', 'html', 'lcov', 'json', 'json-summary'],
  coveragePathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    '/test/',
    '\\.spec\\.ts$',
    '\\.interface\\.ts$',
    '\\.dto\\.ts$',
    '\\.entity\\.ts$',
    '\\.module\\.ts$',
    '\\.config\\.ts$',
    'datasource\\.ts$',
  ],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70,
    },
  },
  testEnvironment: 'node',
  setupFilesAfterEnv: ['<rootDir>/test/setup.ts'],
  // Otimizações de performance
  maxWorkers: '50%',
  clearMocks: true,
  restoreMocks: true,
  testTimeout: 30000,
  // Silenciar logs durante testes
  silent: false,
  verbose: false,
};

export default config;

