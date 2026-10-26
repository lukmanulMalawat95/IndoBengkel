module.exports = {
  rootDir: ".",
  testEnvironment: "node",
  testRegex: "test/.*\\.e2e-spec\\.ts$",
  transform: {
    "^.+\\.ts$": ["ts-jest", { tsconfig: "tsconfig.json" }],
  },
  setupFiles: ["<rootDir>/test/setup-env.ts"],
  globalSetup: "<rootDir>/test/global-setup.ts",
  testTimeout: 60000,
  maxWorkers: 1,
  verbose: true,
};
