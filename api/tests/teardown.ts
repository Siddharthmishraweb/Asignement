export default async (): Promise<void> => {
  try {
    if (global.testDatabase) {
      await global.testDatabase.close();
    }
    if (global.testRedis) {
      await global.testRedis.disconnect();
    }
  } catch (error) {
    console.error("Error during global teardown:", error);
  }
};
