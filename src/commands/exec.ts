import {Runner} from 'rpscript-parser';
import { EventEmitter } from 'events';
import {Logger} from '../core/logger';
import {ErrorMessage} from '../format/error_msg';
import fs from 'fs';
import * as R from '../../lib/ramda.min';

export class ExecCommand {

  runner:Runner;
  logger:any;

  debug:boolean;

  constructor(config, event?:(evt:EventEmitter)=>void) {
    this.runner = new Runner(config);
    this.debug = config.debug;

    if(!event)
      this.registerDefaultEvents(this.runner);
    else
      event(this.runner);
  }

  async run(filename:string,args:any[]=[]) : Promise<any>{
    this.logger = Logger.createRunnerLogger(filename,this.debug);

    try{
      let result = await this.runner.execute(filename,args);

      return result;
    
    }catch(er){
      console.error(er);
    }
  }

  async runStatement(content:string) : Promise<any>{
    this.logger = Logger.createRunnerLogger('none',this.debug);
    try{
      let result = await this.runner.execute(null,[],content);

      return result;
    
    }catch(er){
      console.error(er);
    }
  }

  private printParams (params:any[]) : string{

    function genString (p) {
      if(typeof p === 'function') return '[function]';
      else if(typeof p === 'object'){
        try{
          return JSON.stringify(p);
        }catch(err){
          return "";
        } 
      }
      else if(typeof p === 'symbol'){
        return p.toString();
      }
      else return p;
    }

    if(Array.isArray(params))
      return R.map(genString,params).join(' , ');
    else
      return genString(params);
  }

  registerDefaultEvents(evtEmt:EventEmitter) : void{
    evtEmt.on(Runner.COMPILE_START_EVT, params => {
      this.logger.debug('compilation - start for '+params);
    });
    evtEmt.on(Runner.COMPILED_EVT, params => {
      this.logger.debug('compilation - completed');
      // console.log(params.transpile);
    });
    evtEmt.on(Runner.LINT_EVT, params => {
      this.logger.debug('linting - completed');
    });
    evtEmt.on(Runner.TRANSPILE_EVT, params => {
      // console.log(params.fullContent);
      fs.writeFileSync('.rpscript/temp.ts',params.fullContent);

      this.logger.debug('transpilation completed. output save to .rpscript/temp.ts');
    });
    evtEmt.on(Runner.MOD_DISABLED_EVT, params => {
      this.logger.debug('module - disabled '+params);
    });
    evtEmt.on(Runner.MOD_LOADED_EVT, params => {
      this.logger.debug('module - loaded '+params);
    });

    evtEmt.on(Runner.TRANSPILE_ERR_EVT, params => {
      ErrorMessage.handleKeywordMessage(params);
    });



    evtEmt.on(Runner.START_EVT, params => {
      this.logger.debug('start of execution');
    });
    evtEmt.on(Runner.ACTION_EVT, (args) => {
      let arg = args[0];
      let modName = arg[0], actionName = arg[1], evt = arg[2], params = arg[3];

      this.logger.debug(`action - ${evt} execute : ${this.printParams(params)} `);
      if(evt==='error') {
        this.logger.error(`ERROR : ${params}`);
      }
    });
    evtEmt.on(Runner.END_EVT, params => {
      this.logger.debug('end of execution');
    });

    evtEmt.on(Runner.CTX_PRIOR_SET_EVT, params => {
      this.logger.debug(`Priority set => ${params}`);
    });

  }


  private getFileName (filepath:string) :string {
    let index = filepath.lastIndexOf('/');
    let dotIndex = filepath.lastIndexOf('.');
    
    return filepath.substring(index+1,dotIndex);
  }

  static parseProgramOpts (program) :Object{
    return R.pickBy((v,k)=> v !== undefined,
    {
      outputTS:program.skipOutputTS, linting:program.skipLinting, 
      outputDir:program.outputDir,skipRun:program.skipRun,
      debug:program.debug,modules:program.modules
    })
  }

}
