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
    command:'python3 -m http.server 8080 --bind 127.0.0.1',
    url:'http://127.0.0.1:8080/',
    reuseExistingServer:true,
    timeout:120000
  }
});
