const {execFileSync}=require('node:child_process');
const fs=require('node:fs'),path=require('node:path');

const firstPartyJs=file=>/^(js\/contour(?:-[\w-]+)?\.js|scripts\/.*\.cjs|tests\/.*\.cjs|playwright\.config\.cjs)$/.test(file);
const allBrowserSpecs=()=>fs.readdirSync(path.resolve(__dirname,'../tests/browser')).filter(file=>file.endsWith('.spec.cjs')).map(file=>'tests/browser/'+file);

/** File ownership determines coverage; keywords only add checks, never remove them. */
function scopeFor(files,patches='',availableSpecs=allBrowserSpecs()){
 const changed=re=>files.some(file=>re.test(file)),patch=re=>re.test(patches);
 const testInfra=changed(/^(\.github\/workflows\/quality\.yml|scripts\/(quality-scope|check-inline|serve)\.cjs|tests\/unit\/|playwright\.config\.cjs|package(?:-lock)?\.json)/);
 const resourceVersion=changed(/^(index\.html|scripts\/resource-version\.cjs)$/);
 const regression=testInfra||changed(/^(js\/contour-(config|data|source)\.js|scripts\/verify-contour\.cjs|Накопичення\.xlsx)$/);
 const browserCore=testInfra||regression||changed(/^(index\.html|css\/contour.*\.css|js\/contour.*\.js|tests\/browser\/core\.spec\.cjs)$/);
 const browserSticky=testInfra||changed(/^(js\/contour(?:-navigation)?\.js|tests\/browser\/sticky\.spec\.cjs)$/)||patch(/cards-away|workspace-dock|sticky|#metrics/i);
 const browserBps=testInfra||changed(/^(css\/contour-detail\.css|tests\/browser\/bps\.spec\.cjs)$/)||patch(/БпС|FPV|drone/i);
 const browserCharts=testInfra||regression||changed(/^(js\/contour(?:-charts|-compare)?\.js|tests\/browser\/charts\.spec\.cjs)$/)||patch(/ApexCharts|chart|axisRange|integerAxis/i);
 const browserUnits=testInfra||regression||changed(/^(js\/contour-units\.js|css\/contour-units\.css|tests\/browser\/units\.spec\.cjs)$/)||patch(/unit-manager|unit-status|unit-expand|archiv|ієрарх|підрозділ|угрупован/i);
 const browserComparison=testInfra||regression||changed(/^(index\.html|js\/contour(?:-compare|-view|-charts|-units|-navigation)?\.js|css\/contour(?:-compare|-refinement)?\.css|tests\/browser\/compare[^/]*\.spec\.cjs)$/);
 const selected=new Set(files.filter(file=>availableSpecs.includes(file)));
 for(const [enabled,name] of [[browserCore,'core'],[browserSticky,'sticky'],[browserBps,'bps'],[browserCharts,'charts'],[browserUnits,'units']])if(enabled)selected.add('tests/browser/'+name+'.spec.cjs');
 if(browserComparison)for(const file of availableSpecs.filter(file=>/\/compare[^/]*\.spec\.cjs$/.test(file)))selected.add(file);
 if(testInfra)for(const file of availableSpecs)selected.add(file);
 const syntaxFiles=files.filter(firstPartyJs),inlineSyntax=files.includes('index.html');
 return {files,syntax:syntaxFiles.length>0||inlineSyntax,syntaxFiles,inlineSyntax,resourceVersion,regression,browserCore,browserSticky,browserBps,browserCharts,browserUnits,browserComparison,browserFiles:[...selected].sort(),testInfra};
}

function main(){
 const args=process.argv.slice(2),arg=name=>{const i=args.indexOf(name);return i>=0?args[i+1]:null};
 const base=arg('--base')||process.env.QUALITY_BASE||'HEAD^',head=arg('--head')||process.env.QUALITY_HEAD||'HEAD',range=base+'...'+head;
 const run=args=>execFileSync('git',args,{encoding:'utf8',stdio:['ignore','pipe','pipe']});
 const files=run(['-c','core.quotepath=false','diff','--name-only',range]).split(/\r?\n/).filter(Boolean);
 const patches=files.filter(file=>/^(js\/|css\/|index\.html$)/.test(file)).map(file=>run(['diff','--unified=0',range,'--',file])).join('\n');
 const scope={base,head,...scopeFor(files,patches)};console.log(JSON.stringify(scope,null,2));
 if(process.env.GITHUB_OUTPUT){
  const lines=Object.entries({syntax:scope.syntax,inline_syntax:scope.inlineSyntax,resource_version:scope.resourceVersion,regression:scope.regression,browser:scope.browserFiles.length>0}).map(([key,value])=>key+'='+value);
  for(const [key,list] of [['syntax_files',scope.syntaxFiles],['browser_files',scope.browserFiles]])lines.push(key+'<<QUALITY_EOF',...list,'QUALITY_EOF');
  fs.appendFileSync(process.env.GITHUB_OUTPUT,lines.join('\n')+'\n');
 }
}
if(require.main===module){try{main()}catch(error){console.error(error.message);process.exitCode=2}}
module.exports={scopeFor};
