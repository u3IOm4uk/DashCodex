const {execFileSync}=require('node:child_process');
const fs=require('node:fs');

const args=process.argv.slice(2);
const arg=name=>{const i=args.indexOf(name);return i>=0?args[i+1]:null};
const base=arg('--base')||process.env.QUALITY_BASE||'HEAD^';
const head=arg('--head')||process.env.QUALITY_HEAD||'HEAD';
const range=`${base}...${head}`;
const run=(cmdArgs)=>execFileSync('git',cmdArgs,{encoding:'utf8',stdio:['ignore','pipe','pipe']});
let files=[];
try{files=run(['diff','--name-only',range]).split(/\r?\n/).filter(Boolean)}catch(error){console.error(`Не вдалося визначити diff ${range}: ${error.message}`);process.exit(2)}

const firstPartyJs=file=>/^(js\/contour(?:-[\w-]+)?\.js|scripts\/.*\.cjs|tests\/.*\.cjs|playwright\.config\.cjs)$/.test(file);
const patches=files.filter(file=>/^(js\/|css\/|index\.html$)/.test(file)).map(file=>{
 try{return run(['diff','--unified=0',range,'--',file])}catch{return ''}
}).join('\n');
const changed=re=>files.some(file=>re.test(file));
const patch=re=>re.test(patches);
const testInfra=changed(/^(\.github\/workflows\/quality\.yml|scripts\/quality-scope\.cjs|playwright\.config\.cjs|package\.json)$/);
const resourceVersion=changed(/^(index\.html|scripts\/resource-version\.cjs)$/);
const regression=testInfra||changed(/^(js\/contour-(config|data)\.js|\.audit\/verify-contour\.cjs|Накопичення\.xlsx)$/);
const browserCore=testInfra||changed(/^(index\.html|css\/contour.*\.css|js\/contour(?:-view|-navigation|-charts)?\.js|tests\/browser\/core\.spec\.cjs)$/)||regression;
const browserSticky=testInfra||changed(/^(js\/contour-navigation\.js|tests\/browser\/sticky\.spec\.cjs)$/)||patch(/cards-away|workspace-dock|dockScroll|selectCategory|followCategory|scrollTo|sticky|rail-heading|#metrics/i);
const browserBps=testInfra||changed(/^(css\/contour-detail\.css|tests\/browser\/bps\.spec\.cjs)$/)||patch(/БпС|FPV|drone|drones|droneTypes|showDroneDetail|drone-type|droneCategory/i);
const browserCharts=testInfra||changed(/^(js\/contour-charts\.js|tests\/browser\/charts\.spec\.cjs)$/)||patch(/ApexCharts|chart|temporalOptions|miniBar|axisRange|integerAxis|graph-tabs|data-chart/i);
const browserUnits=testInfra||changed(/^(js\/contour-units\.js|css\/contour-units\.css|tests\/browser\/units\.spec\.cjs)$/)||patch(/unit-manager|unit-status|unit-expand|archiv|ієрарх|підрозділ|угрупован/i);
const syntaxFiles=files.filter(firstPartyJs);
const syntax=syntaxFiles.length>0;
const scope={base,head,files,syntax,syntaxFiles,resourceVersion,regression,browserCore,browserSticky,browserBps,browserCharts,browserUnits,testInfra};
console.log(JSON.stringify(scope,null,2));
if(process.env.GITHUB_OUTPUT){
 const lines=[
  `syntax=${syntax}`,
  `resource_version=${resourceVersion}`,
  `regression=${regression}`,
  `browser_core=${browserCore}`,
  `browser_sticky=${browserSticky}`,
  `browser_bps=${browserBps}`,
  `browser_charts=${browserCharts}`,
  `browser_units=${browserUnits}`,
  'syntax_files<<QUALITY_EOF',
  ...syntaxFiles,
  'QUALITY_EOF'
 ];
 fs.appendFileSync(process.env.GITHUB_OUTPUT,lines.join('\n')+'\n');
}