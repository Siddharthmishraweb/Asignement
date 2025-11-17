module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/src", "<rootDir>/tests"],
  testMatch: ["**/tests*.test.ts", "**/tests*.spec.ts", "**/__tests__*.ts"],
  transform: {
    "^.+\\.ts$": [
      "ts-jest",
      {
        tsconfig: "tsconfig.json",
      },
    ],
  },
  collectCoverageFrom: [
    "src*.ts",
    "!src*.d.ts",
    "!src/index.ts",
    "!src/scriptstests/unit*.test.ts",
  ],
};
