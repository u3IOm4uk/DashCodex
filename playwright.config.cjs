const {defineConfig}=require('@playwright/test');

module.exports=defineConfig({
  testDir:'./tests/browser',
  timeout:30000,
  expect:{timeout:7000},
  workers:1,
  reporter:'line',
  use:{
    baseURL:'http://127.0.0.1:8080',
    headless:true,
    trace:'retain-on-failure'
  },
  webServer:{
    command:'node scripts/serve.cjs',
    url:'http://127.0.0.1:8080/',
    reuseExistingServer:!process.env.CI,
    timeout:120000
  }
});
