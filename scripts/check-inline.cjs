const fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync('index.html','utf8');
for(const [index,match] of [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)].entries()){
 if(!/\bsrc\s*=/.test(match[1]))new vm.Script(match[2],{filename:`index.html:inline-${index}`});
}
console.log('PASS: inline JavaScript syntax');
