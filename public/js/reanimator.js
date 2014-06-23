(function (global) {
/**
 * almond 0.2.3 Copyright (c) 2011-2012, The Dojo Foundation All Rights Reserved.
 * Available via the MIT or new BSD license.
 * see: http://github.com/jrburke/almond for details
 */
//Going sloppy to avoid 'use strict' string cost, but strict practices should
//be followed.
/*jslint sloppy: true */
/*global setTimeout: false */

var requirejs, require, define;
(function (undef) {
    var main, req, makeMap, handlers,
        defined = {},
        waiting = {},
        config = {},
        defining = {},
        hasOwn = Object.prototype.hasOwnProperty,
        aps = [].slice;

    function hasProp(obj, prop) {
        return hasOwn.call(obj, prop);
    }

    /**
     * Given a relative module name, like ./something, normalize it to
     * a real name that can be mapped to a path.
     * @param {String} name the relative name
     * @param {String} baseName a real name that the name arg is relative
     * to.
     * @returns {String} normalized name
     */
    function normalize(name, baseName) {
        var nameParts, nameSegment, mapValue, foundMap,
            foundI, foundStarMap, starI, i, j, part,
            baseParts = baseName && baseName.split("/"),
            map = config.map,
            starMap = (map && map['*']) || {};

        //Adjust any relative paths.
        if (name && name.charAt(0) === ".") {
            //If have a base name, try to normalize against it,
            //otherwise, assume it is a top-level require that will
            //be relative to baseUrl in the end.
            if (baseName) {
                //Convert baseName to array, and lop off the last part,
                //so that . matches that "directory" and not name of the baseName's
                //module. For instance, baseName of "one/two/three", maps to
                //"one/two/three.js", but we want the directory, "one/two" for
                //this normalization.
                baseParts = baseParts.slice(0, baseParts.length - 1);

                name = baseParts.concat(name.split("/"));

                //start trimDots
                for (i = 0; i < name.length; i += 1) {
                    part = name[i];
                    if (part === ".") {
                        name.splice(i, 1);
                        i -= 1;
                    } else if (part === "..") {
                        if (i === 1 && (name[2] === '..' || name[0] === '..')) {
                            //End of the line. Keep at least one non-dot
                            //path segment at the front so it can be mapped
                            //correctly to disk. Otherwise, there is likely
                            //no path mapping for a path starting with '..'.
                            //This can still fail, but catches the most reasonable
                            //uses of ..
                            break;
                        } else if (i > 0) {
                            name.splice(i - 1, 2);
                            i -= 2;
                        }
                    }
                }
                //end trimDots

                name = name.join("/");
            } else if (name.indexOf('./') === 0) {
                // No baseName, so this is ID is resolved relative
                // to baseUrl, pull off the leading dot.
                name = name.substring(2);
            }
        }

        //Apply map config if available.
        if ((baseParts || starMap) && map) {
            nameParts = name.split('/');

            for (i = nameParts.length; i > 0; i -= 1) {
                nameSegment = nameParts.slice(0, i).join("/");

                if (baseParts) {
                    //Find the longest baseName segment match in the config.
                    //So, do joins on the biggest to smallest lengths of baseParts.
                    for (j = baseParts.length; j > 0; j -= 1) {
                        mapValue = map[baseParts.slice(0, j).join('/')];

                        //baseName segment has  config, find if it has one for
                        //this name.
                        if (mapValue) {
                            mapValue = mapValue[nameSegment];
                            if (mapValue) {
                                //Match, update name to the new value.
                                foundMap = mapValue;
                                foundI = i;
                                break;
                            }
                        }
                    }
                }

                if (foundMap) {
                    break;
                }

                //Check for a star map match, but just hold on to it,
                //if there is a shorter segment match later in a matching
                //config, then favor over this star map.
                if (!foundStarMap && starMap && starMap[nameSegment]) {
                    foundStarMap = starMap[nameSegment];
                    starI = i;
                }
            }

            if (!foundMap && foundStarMap) {
                foundMap = foundStarMap;
                foundI = starI;
            }

            if (foundMap) {
                nameParts.splice(0, foundI, foundMap);
                name = nameParts.join('/');
            }
        }

        return name;
    }

    function makeRequire(relName, forceSync) {
        return function () {
            //A version of a require function that passes a moduleName
            //value for items that may need to
            //look up paths relative to the moduleName
            return req.apply(undef, aps.call(arguments, 0).concat([relName, forceSync]));
        };
    }

    function makeNormalize(relName) {
        return function (name) {
            return normalize(name, relName);
        };
    }

    function makeLoad(depName) {
        return function (value) {
            defined[depName] = value;
        };
    }

    function callDep(name) {
        if (hasProp(waiting, name)) {
            var args = waiting[name];
            delete waiting[name];
            defining[name] = true;
            main.apply(undef, args);
        }

        if (!hasProp(defined, name) && !hasProp(defining, name)) {
            throw new Error('No ' + name);
        }
        return defined[name];
    }

    //Turns a plugin!resource to [plugin, resource]
    //with the plugin being undefined if the name
    //did not have a plugin prefix.
    function splitPrefix(name) {
        var prefix,
            index = name ? name.indexOf('!') : -1;
        if (index > -1) {
            prefix = name.substring(0, index);
            name = name.substring(index + 1, name.length);
        }
        return [prefix, name];
    }

    /**
     * Makes a name map, normalizing the name, and using a plugin
     * for normalization if necessary. Grabs a ref to plugin
     * too, as an optimization.
     */
    makeMap = function (name, relName) {
        var plugin,
            parts = splitPrefix(name),
            prefix = parts[0];

        name = parts[1];

        if (prefix) {
            prefix = normalize(prefix, relName);
            plugin = callDep(prefix);
        }

        //Normalize according
        if (prefix) {
            if (plugin && plugin.normalize) {
                name = plugin.normalize(name, makeNormalize(relName));
            } else {
                name = normalize(name, relName);
            }
        } else {
            name = normalize(name, relName);
            parts = splitPrefix(name);
            prefix = parts[0];
            name = parts[1];
            if (prefix) {
                plugin = callDep(prefix);
            }
        }

        //Using ridiculous property names for space reasons
        return {
            f: prefix ? prefix + '!' + name : name, //fullName
            n: name,
            pr: prefix,
            p: plugin
        };
    };

    function makeConfig(name) {
        return function () {
            return (config && config.config && config.config[name]) || {};
        };
    }

    handlers = {
        require: function (name) {
            return makeRequire(name);
        },
        exports: function (name) {
            var e = defined[name];
            if (typeof e !== 'undefined') {
                return e;
            } else {
                return (defined[name] = {});
            }
        },
        module: function (name) {
            return {
                id: name,
                uri: '',
                exports: defined[name],
                config: makeConfig(name)
            };
        }
    };

    main = function (name, deps, callback, relName) {
        var cjsModule, depName, ret, map, i,
            args = [],
            usingExports;

        //Use name if no relName
        relName = relName || name;

        //Call the callback to define the module, if necessary.
        if (typeof callback === 'function') {

            //Pull out the defined dependencies and pass the ordered
            //values to the callback.
            //Default to [require, exports, module] if no deps
            deps = !deps.length && callback.length ? ['require', 'exports', 'module'] : deps;
            for (i = 0; i < deps.length; i += 1) {
                map = makeMap(deps[i], relName);
                depName = map.f;

                //Fast path CommonJS standard dependencies.
                if (depName === "require") {
                    args[i] = handlers.require(name);
                } else if (depName === "exports") {
                    //CommonJS module spec 1.1
                    args[i] = handlers.exports(name);
                    usingExports = true;
                } else if (depName === "module") {
                    //CommonJS module spec 1.1
                    cjsModule = args[i] = handlers.module(name);
                } else if (hasProp(defined, depName) ||
                           hasProp(waiting, depName) ||
                           hasProp(defining, depName)) {
                    args[i] = callDep(depName);
                } else if (map.p) {
                    map.p.load(map.n, makeRequire(relName, true), makeLoad(depName), {});
                    args[i] = defined[depName];
                } else {
                    throw new Error(name + ' missing ' + depName);
                }
            }

            ret = callback.apply(defined[name], args);

            if (name) {
                //If setting exports via "module" is in play,
                //favor that over return value and exports. After that,
                //favor a non-undefined return value over exports use.
                if (cjsModule && cjsModule.exports !== undef &&
                        cjsModule.exports !== defined[name]) {
                    defined[name] = cjsModule.exports;
                } else if (ret !== undef || !usingExports) {
                    //Use the return value from the function.
                    defined[name] = ret;
                }
            }
        } else if (name) {
            //May just be an object definition for the module. Only
            //worry about defining if have a module name.
            defined[name] = callback;
        }
    };

    requirejs = require = req = function (deps, callback, relName, forceSync, alt) {
        if (typeof deps === "string") {
            if (handlers[deps]) {
                //callback in this case is really relName
                return handlers[deps](callback);
            }
            //Just return the module wanted. In this scenario, the
            //deps arg is the module name, and second arg (if passed)
            //is just the relName.
            //Normalize module name, if it contains . or ..
            return callDep(makeMap(deps, callback).f);
        } else if (!deps.splice) {
            //deps is a config object, not an array.
            config = deps;
            if (callback.splice) {
                //callback is an array, which means it is a dependency list.
                //Adjust args if there are dependencies
                deps = callback;
                callback = relName;
                relName = null;
            } else {
                deps = undef;
            }
        }

        //Support require(['a'])
        callback = callback || function () {};

        //If relName is a function, it is an errback handler,
        //so remove it.
        if (typeof relName === 'function') {
            relName = forceSync;
            forceSync = alt;
        }

        //Simulate async callback;
        if (forceSync) {
            main(undef, deps, callback, relName);
        } else {
            setTimeout(function () {
                main(undef, deps, callback, relName);
            }, 15);
        }

        return req;
    };

    /**
     * Just drops the config on the floor, but returns req in case
     * the config return value is used.
     */
    req.config = function (cfg) {
        config = cfg;
        return req;
    };

    define = function (name, deps, callback) {

        //This module may not have dependencies
        if (!deps.splice) {
            //deps is not an array, so probably means
            //an object literal or factory function for
            //the value. Adjust args.
            callback = deps;
            deps = [];
        }

        if (!hasProp(defined, name) && !hasProp(waiting, name)) {
            waiting[name] = [name, deps, callback];
        }
    };

    define.amd = {
        jQuery: true
    };
}());

define("../node_modules/almond/almond", function(){});

define('reanimator/core',['require','exports','module'],function (require, exports, module) {
var native_date = Date;
/* vim: set et ts=2 sts=2 sw=2: */
var plugins = {};
var native = {};

// Function.bind polyfill from MDN
if (!Function.prototype.bind) {
  Function.prototype.bind = function (oThis) {
    if (typeof this !== 'function') {
      // closest thing possible to the ECMAScript 5
      // internal IsCallable function

      throw new TypeError('Function.prototype.bind - ' +
        'what is trying to be bound is not callable');
    }

    var aArgs = Array.prototype.slice.call(arguments, 1), 
      fToBind = this, 
      fNOP = function () {},
      fBound = function () {
        return fToBind.apply(this instanceof Function && oThis ? this : oThis,
          aArgs.concat(Array.prototype.slice.call(arguments)));
      };

    fNOP.prototype = this.prototype;
    fBound.prototype = new fNOP();

    return fBound;
  };
}

function capture(isTopWindow, config) {
  this.state.capturing = true;
  this.state.config = config || {};
	  
  if(isTopWindow){
	  // If the current window is the topmost window, initialize all log objects
	  this.state.log = {
	    events: []
	  };
  }else{
	  // If the current window is not the topmost window (maybe a frame), store the events to the log object in topmost window
	  this.state.log = window.top.Reanimator.state.log;
  }

  for (var k in plugins) {
    plugins[k].capture(this.state.log, config, isTopWindow);
  }
}

//Add DOMContentLoaded event listener to all frames to check whether all frames have been loaded
var frames_num = 0, loaded_frames_num = 0;
function addListener(curWindow){
	frames_num ++;
    window.origAddEventListener.call(curWindow,"DOMContentLoaded",function onDomContentLoaded(event){
	//curWindow.addEventListener("DOMContentLoaded", function onDomContentLoaded(event){
		loaded_frames_num ++;
		var frames = event.target.defaultView.frames;
		for(var i=0; i<frames.length; i++){
			addListener(frames[i]);
		}

        window.origRemoveEventListener(curWindow,'DOMContentLoaded', onDomContentLoaded);
		//curWindow.removeEventListener('DOMContentLoaded', onDomContentLoaded);
	});
}

function replay(log, config, isTopWindow) {
  this.state.replaying = true;
  this.state.config = replay.config = config = config || {};
  
  if(isTopWindow){
	  this.state.log = replay.log = log;
      // added by guoquan
      // refine the recording logs;
      this.log = {events: []};
	  addListener(document);
  }else{
	  this.state.log = replay.log = window.top.Reanimator.state.log;
      //added by guoquan
      //this.log store the capture log information;
      this.log = window.top.Reanimator.log;
  }
  
  for (var k in plugins) {
    if (plugins[k].beforeReplay) {
      plugins[k].beforeReplay(log, config, isTopWindow);
    }
  }

  // Only replay logs stored in topmost window
  if(isTopWindow){
	  log.events = (log.events || []).slice().reverse();
      console.log(log.events.length);
	  if (log.events.length > 0) {
		    // Check whether the DOM nodes in all frames have been loaded. If so, start replay, otherwise wait. 
			native.setTimeout.call(global, function start(){
			if(typeof frames_num == 'undefined' || typeof loaded_frames_num == 'undefined' || loaded_frames_num < frames_num){
				console.log("# Total frames: " + frames_num);
				console.log("# Loaded frames: " + loaded_frames_num);
				native.setTimeout.call(global, start, 300);
			}else{
		        native.setTimeout.call(global, replay.loop(), 0);
			}
		}, 0);
	  } 
  }
}

replay.loop = function replayLoop() {
  var log = replay.log;
  var event = log.events.pop();
  var delay, now;

  var replayer = plugins[event.type].replay;

  //added by guoquan
  // if event.type is not DOM event, then push the event to Reanimator.log
  if(event.type == "xhr" || event.type == "dom-content-loaded"){
      Reanimator.log.events.push(event);
  }

  if (!replayer) {
    throw 'Cannot replay event of type "' + event.type + '"';
  }

  // if the replayer accepts a second argument, it must be a callback
  var async = replayer.length > 1;
  if (async) {
    replayer(event, log.events.length > 0 ? replayLoop : function () {console.log("finished: "+native_date.now());});
  } else {
    replayer(event);

    if (log.events.length > 0) {
      delay = 0;
      if (replay.config.delay === 'realtime') {
        now = native.Date.now();
        delay = log.events[log.events.length - 1].time - event.time;

        if (replay.lastEventTime) {
          // crude correction for skew during replay
          delay -= (now - replay.lastEventTime) - replay.expectedDelay;
        }
        
        if(delay < 0){
        	delay = 0;
        }
        
        replay.lastEventTime = now;
        replay.expectedDelay = delay;
      } else {
        delay = replay.config.delay || 0;
      }

      native.setTimeout.call(global, replay.loop, delay);
    }else{
        //added by guoquan
        //store the log information into the localstorage;
        var id = sessionStorage['reanimator_replay_' + window.top.reanimator_tab_id];
        localStorage['reanimator-' + id] = JSON.stringify(Reanimator.log);


    	console.log("finished: "+native_date.now());
    }
  }
};

function flush() {
  if (!this.state.log) {
    throw 'Must call capture before calling flush';
  }

  //return JSON.parse(JSON.stringify(this.state.log));
  return this.state.log;
}

function deleteCookie(c_name) {
    document.cookie = encodeURIComponent(c_name) + "=deleted; expires=" + new Date(0).toUTCString();
}

function cleanUp() {
  this.state.capturing = this.state.replaying = false;
  for (var k in plugins) {
    plugins[k].cleanUp();
  }
  deleteCookie("replayid");
}

function plug(type, plugin) {
  plugins[type] = plugin;
  plugin.init(native);

  if (this.state.capturing && plugin.capture) {
    plugin.capture(this.state.log, this.state.config);
  } else if (this.state.replaying && plugin.beforeReplay) {
    plugin.beforeReplay(this.state.log, this.state.config);
  }
}

module.exports = global.Reanimator = {
  state: {
    capturing: false,
    replaying: false
  },

  /**
   * ## Reanimator.capture
   * **Capture non-deterministic input**
   *
   * Call this method to begin logging non-deterministic input to your
   * JavaScript application. To capture a useful log, you must call
   * `Reanimator.capture` before such input occurs, but after libraries like
   * jQuery have been loaded.
   *
   * The log is reset whenever this method is called.
   */
  capture: capture,

  /**
   * ## Reanimator.replay
   * **Replay a log of non-deterministic input**
   *
   * ### Arguments
   *
   * - `log` - *object* - the log to replay, in the format emitted by
   *   `Reanimator.flush`
   * - `config` - *object* - configuration object
   *   - `config.delay` - *string* | *integer* - how long Reanimator should wait
   *     before replaying the next event in the log
   *       
   *       For a fixed delay, specify the number of ms between steps (the
   *       default is 0). If the string `'realtime'` is specified, Reanimator
   *       will make a good faith effort to replay the events with the actual
   *       delays recorded in the log.
   */
  replay: replay,

  /**
   * ## Reanimator.flush
   * **Return a copy of the current log**
   * 
   * Returns a copy of the current log as an object with the following
   * properties:
   *
   * - `dates` - [ *number* ] - captured dates, specified in ms since the epoch
   * - `random` - [ *number* ] - captured random numbers generated by
   *   `Math.random`
   * - `events` - [ *object* ] - captured callback invocations
   *
   *     Each element is an object with the following properties:
   *   - `type` - *string* - the type of the recorded callback
   *   - `time` - *number* - the time the callback was fired (ms since the epoch)
   *   - `details` - *any* - any additional details necessary to replay the
   *     callback
   */
  flush: flush,

  /**
   * ## Reanimator.cleanUp
   * **Stop capturing or replaying and restore native methods and objects**
   *
   * This method does *not* clear the most recent log.
   */
  cleanUp: cleanUp,

  /**
   * ## Reanimator.plug
   * **Install a plugin to capture and replay some non-deterministic input**
   * 
   * ### Arguments
   *
   * - `type` - *string* - a unique string corresponding to the `type` property
   *   of any events the plugin will log
   * - `plugin` - *object* - the plugin to install
   *
   * A plugin is an object that implements the following methods:
   *
   * - `init`: initialize the plugin
   *
   *     Called once, by `plug`
   *
   *     Arguments
   *   - `native` - *object* - an object to store a reference to any native
   *     methods or objects the plugin interposes on
   *
   * - `capture`: prepare to capture the input the plugin is responsible for
   *
   *     Called by `Reanimator.capture`
   *
   * - `cleanUp` - restore any native methods or objects the plugin interposed
   *   on
   *
   * - `beforeReplay` - prepare to replay
   *
   *     **Optional**; called by `Reanimator.replay` immediately before the
   *     first event is replayed
   *
   *     Arguments
   *   - `log` - *object* - the log to be replayed
   *   - `config` - *object* - the replay configuration
   *
   * - `replay` - replay a captured event
   *
   *     **Required** if the plugin logs to `events`, **optional** otherwise
   *
   *     Arguments
   *   - `event` - *object* - the event to replay, in the format specified above
   *     in `Reanimator.flush`
   */
  plug: plug
};

});

define('reanimator/plugins/date',['require','exports','module','../core'],function (require, exports, module) {
/* vim: set et ts=2 sts=2 sw=2: */
var Reanimator = require('../core');

var replay = {};
var _native, _log;

// Date implementation for both capture and replay
function _Date(replaying, year, month, day, hours, minutes, seconds, ms) {
  var argsLen = arguments.length;
  var date;

  if (this instanceof Date) {
    // called as a constructor, return a Date instance
    // Use Date.parse may lose some precision of the date time string. Use getTime() instead
    if (argsLen < 2) {
      if (!replaying) {
        date = this._value = new _native.Date();
        //_log.dates.push(_native.Date.parse(date));
        _log.dates.push(date.getTime());
      } else {

        //modified by guoquan
        var vDate = _log.dates.pop();
        this._value = new _native.Date(vDate);
        Reanimator.log.dates.push(vDate);
      }
    } else if (argsLen === 2) {
      this._value = new _native.Date(year);
    } else if (argsLen === 3) {
      this._value = new _native.Date(year, month);
    } else if (argsLen === 4) {
      this._value = new _native.Date(year, month, day);
    } else if (argsLen === 5) {
      this._value = new _native.Date(year, month, day, hours);
    } else if (argsLen === 6) {
      this._value = new _native.Date(year, month, day, hours, minutes);
    } else if (argsLen === 7) {
      this._value =
        new _native.Date(year, month, day, hours, minutes, seconds);
    } else {
      this._value =
        new _native.Date(year, month, day, hours, minutes, seconds, ms);
    }

    return this;
  } else {
    // called as a function, return the current time as a string

    if (!replaying) {
      date = _native.Date();
      //_log.dates.push(_native.Date.parse(date));
      _log.dates.push(date.getTime());
    } else {
      //modified by guoquan
        var vsDate = _log.dates.pop();
        date = (new _native.Date(vsDate)).toString();
        Reanimator.log.dates.push(vsDate);
    }

    return date;
  }
}

// Construct a prototype that delegates to a native Date instance stored in
// the instance's _value property
var prototypeMethods = Object.getOwnPropertyNames(global.Date.prototype);
var _Date_prototype = {};
prototypeMethods.forEach(function (method) {
  _Date_prototype[method] = function () {
    return this._value[method].
      apply(this._value, Array.prototype.slice.call(arguments));
  };
});

function capture_Date () {
  return _Date.
    apply(this, [false].concat(Array.prototype.slice.call(arguments)));
}

capture_Date.prototype = _Date_prototype;
capture_Date.UTC = global.Date.UTC.bind(global.Date);
capture_Date.parse = global.Date.parse.bind(global.Date);

capture_Date.now = function capture_Date_now () {
  var now = _native.Date.now();
  _log.dates.push(now);
  return now;
};

function replay_Date () {
  return _Date.
    apply(this, [true].concat(Array.prototype.slice.call(arguments)));
}

replay_Date.prototype = _Date_prototype;
replay_Date.UTC = global.Date.UTC.bind(global.Date);
replay_Date.parse = global.Date.parse.bind(global.Date);

replay_Date.now = function replay_Date_now () {

    var vlog = _log.dates.pop();
    Reanimator.log.dates.push(vlog);
    return vlog;
};

Reanimator.plug('date', {
  init: function init(native) {
    _native = native;
    _native.Date = global.Date;
  },

  capture: function capture(log, config, isTopWindow) {
	_log = log;
	if(isTopWindow){
		_log.dates = [];
	}
   
    global.Date = capture_Date;
  },

  beforeReplay: function replay(log, config, isTopWindow) {
    _log = log;
    global.Date = replay_Date;
    
    if(isTopWindow){
        _log.dates = (_log.dates || []).slice().reverse();
        // 6.17 modified by guoquan
        Reanimator.log.dates =[];
    }
  },

  cleanUp: function () {
    _log = null;
    global.Date = _native.Date;
  }
});

});

define('reanimator/plugins/interrupts',['require','exports','module','../core'],function (require, exports, module) {
/* vim: set et ts=2 sts=2 sw=2: */
/*jshint evil:true */
var Reanimator = require('../core');

var replay = {};
var _native, _log;

// Use setTimeout api in each frame, however, report the id to topmost window
Reanimator.setTimeout_id = 0;
Reanimator.setTimeout_handlers = {};

function getHandlerFn(type, fn, id) {
  return function () {
    _log.events.push({
      type: type,
      details: {
        id: id
      },
      time: _native.Date.now()
    });
    fn.apply(this, Array.prototype.slice.call(arguments));
  };
}

function capture_setTimeout(code, delay) {
  var args = Array.prototype.slice.call(arguments, 1);
  var handle;

  if (typeof code === 'string') {
    code = new Function(code);
  }

  return _native.setTimeout.apply(global, [
      getHandlerFn('setTimeout', code, window.top.Reanimator.setTimeout_id++)
    ].concat(args));
}

function replay_setTimeout(code, delay) {
  var args = Array.prototype.slice.call(arguments, 2);
  var id = window.top.Reanimator.setTimeout_id;
  var handle;

  if (typeof code === 'string') {
    code = new Function(code);
  }

  window.top.Reanimator.setTimeout_handlers[id] = {
    fn: code,
    args: args
  };
  window.top.Reanimator.setTimeout_id++;

  // Return a big id, as clearInterval and clearTimeout are interchangable to cancel setTimeout and setInterval.
  // Use the large id to avoid the applicaiton cancel our own setTimeout/setInterval timer in the instrumentation
  return id + 10000;
}

//Use setInterval api in each frame, however, report the id to topmost window
Reanimator.setInterval_id = 0;
Reanimator.setInterval_handlers = {};
function capture_setInterval(code, delay) {
  var args = Array.prototype.slice.call(arguments, 1);
  var handle;

  if (typeof code === 'string') {
    code = new Function(code);
  }

  return _native.setInterval.apply(global, [
      getHandlerFn('setInterval', code, window.top.Reanimator.setInterval_id++)
    ].concat(args));
}

function replay_setInterval(code, delay) {
  var args = Array.prototype.slice.call(arguments, 2);
  var id = window.top.Reanimator.setInterval_id;
  var handle;

  if (typeof code === 'string') {
    code = new Function(code);
  }

  window.top.Reanimator.setInterval_handlers[id] = {
    fn: code,
    args: args
  };
  window.top.Reanimator.setInterval_id++;

  return id + 10000;
}

Reanimator.plug('setTimeout', {
  init: function init(native) {
    _native = native;
    _native.setTimeout = global.setTimeout;
  },

  capture: function capture(log, config, isTopWindow) {
    _log = log;
    
    if(isTopWindow){
        Reanimator.setTimeout_id = 0;
    }
    global.setTimeout = capture_setTimeout;
  },

  beforeReplay: function replay(log, config, isTopWindow) {
    _log = log;
    
    if(isTopWindow){
    	Reanimator.setTimeout_id = 0;
        Reanimator.setTimeout_handlers = {};
    }
    global.setTimeout = replay_setTimeout;
  },

  replay: function (event) {

    var handler =  window.top.Reanimator.setTimeout_handlers[event.details.id];
    // schedule the callback for the next tick
    //modified by guoquan
    //invoke the handler function immediately
    //_native.setTimeout.apply(global, [handler.fn, 0].concat(handler.args));
    var rEvent = event;
    rEvent.fun = handler.fn.toString();
    Reanimator.log.events.push(rEvent);
    handler.fn.apply(global,handler.args);

  },

  cleanUp: function () {
    _log = null;
    global.setTimeout = _native.setTimeout;
  }
});

Reanimator.plug('setInterval', {
  init: function init(native) {
    _native = native;
    _native.setInterval = global.setInterval;
  },

  capture: function capture(log, config, isTopWindow) {
    _log = log;
    
    if(isTopWindow){
    	Reanimator.setInterval_id = 0;
    }
    global.setInterval = capture_setInterval;
  },

  beforeReplay: function replay(log, config, isTopWindow) {
    _log = log;
    
    if(isTopWindow){
        Reanimator.setInterval_id = 0;
        Reanimator.setInterval_handlers = {};
    }
	global.setInterval = replay_setInterval;
  },

  replay: function (event) {
    var handler = window.top.Reanimator.setInterval_handlers[event.details.id];
    
    // schedule the callback for the next tick
    // modified by guoquan
    // invoke the handler.fn function immediately
    // _native.setTimeout.apply(global, [handler.fn, 0].concat(handler.args));
     var rEvent = event;
     rEvent.fun = handler.fn.toString();
     Reanimator.log.events.push(rEvent);
     handler.fn.apply(global, handler.args);
  },

  cleanUp: function () {
    _log = null;
    global.setInterval = _native.setInterval;
  }
});

});

define('reanimator/plugins/random',['require','exports','module','../core'],function (require, exports, module) {
/* vim: set et ts=2 sts=2 sw=2: */
/*jshint evil:true */
var Reanimator = require('../core');

var replay = {};
var _native, _log;


capture_random = function () {
  var result = _native.random.call(Math);

  _log.random.push(result);
  return result;
};

replay_random = function () {
  var lrand = _log.random.pop();
  Reanimator.log.random.push(lrand);
  return lrand;
};

Reanimator.plug('random', {
  init: function init(native) {
    _native = native;
    _native.random = global.Math.random;
  },

  capture: function capture(log, config, isTopWindow) {
    _log = log;
    
    if(isTopWindow){
        _log.random = [];
    }

    global.Math.random = capture_random;
  },

  beforeReplay: function replay(log, config, isTopWindow) {
    _log = log;
    global.Math.random = replay_random;
    
    if(isTopWindow){
        _log.random = (_log.random || []).slice().reverse();
        //modified by guoquan
        Reanimator.log.random = [];
    }
  },

  cleanUp: function () {
    _log = null;
    global.Math.random = _native.random;
  }
});

});

define('reanimator/plugins/document-create-event',['require','exports','module','../core'],function (require, exports, module) {
/* vim: set et ts=2 sts=2 sw=2: */
var Reanimator = require('../core');

var replay = {};
var _native;


capture_documentCreateEvent = function (type) {
  var result = _native.documentCreateEvent.call(document, type);

  result._reanimator = {
    synthetic: true
  };

  return result;
};

Reanimator.plug('document-create-event', {
  init: function init(native) {
    _native = native;
    _native.documentCreateEvent = document.createEvent;
  },

  capture: function capture(log, config) {
    document.createEvent = capture_documentCreateEvent;
  },

  cleanUp: function () {
    document.createEvent = _native.documentCreateEvent;
  }
});

});

define('reanimator/util/event/serialization',['require','exports','module'],function (require, exports, module) {
/* vim: set et ts=2 sts=2 sw=2: */

function serialize(ev) {
  var result = {};
  var val;

  for (var k in ev) {
    val = ev[k];
    if (ev[k] === window) {
      result[k] = 'window';
    } else if(k == "path"){
        continue;
    }else if (k === "_reanimator"){
        //added by guoquan
        //dont serialize the replay property
        result[k] = {};
        for(var m in ev[k]) {
            if (m !== "replay") {
                result[k][m] = ev[k][m];
            }
        }
    }else {

      //Note: ev[v] may be a Text node, in this case, get the parent node of ev[k];
      //modified by guoquan

      if(ev[k] instanceof Text){
          result[k] = getTraversal(ev[k].parentNode);
      }else{
          result[k] = ev[k] instanceof Element || ev[k] === document ?
              getTraversal(ev[k]) : ev[k];
      }
    }
  }

  return result;
}

function getTraversal(el) {
  var result = [];
  
  // Figure out whether there are frames first. Find out frame hierarchy for current window
  var frame_result = [];
  var currentWindow = window;
  while (currentWindow.parent !== currentWindow.self){
	  var frames = currentWindow.parent.frames;
	  for(var i=0; i<frames.length; i++){
		  if(frames[i] == currentWindow.self){
			  frame_result.push(i);
			  currentWindow = currentWindow.parent;
			  break;
		  }
	  }
  }
  
  // Find out the dom element hierarchy in current window 
  var parent;

  while (el !== document && el.parentNode) {
    parent = el.parentNode;

    if (el === document.head) {
      result.push('head');
      parent = document;
    } else if (el === document.body) {
      result.push('body');
      parent = document;
    } else {
      // find out index
      for (var i = 0; i < parent.childNodes.length; i++) {
        if (parent.childNodes[i] === el) {
          result.push(i);
          break;
        }
      }
    }
    el = parent;
  }
  
  // Append the frame hierarchy to the dom element hierarchy
  // -1 is the delimiter between dom element hierarchy and frame hierarchy
  result.push(-1); 
  for(var i=0; i<frame_result.length; i++){
	  result.push(frame_result[i]);
  }

  return result;
}


    function domTraverseToElement(traversal) {
        traversal = traversal ? traversal.slice() : traversal;

        if (traversal === null || traversal === void undefined) {
            return traversal;
        } else if (traversal === 'window') {
            return window;
        } else if (traversal.length === 0) {
            return document;
        }

        // Get document object from frame hierarchy first
        var index;
        var el = window.top;
        while(traversal.length > 0 && (index = traversal.pop()) !== -1){
            el = el.frames[index];
        }
        el = el.document;

        // Get dom element from dom hierarchy
        if(traversal.length > 0){
            var index = traversal.pop();
            if (index === 'head') {
                el = el.head;
                overrideDOMLevel1Event(el);

            } else if (index === 'body') {
                el = el.body;
                overrideDOMLevel1Event(el);

            } else if(el.childNodes.length > index){
                el = el.childNodes[index];
                overrideDOMLevel1Event(el);
            }else{
                throw 'Cannot traverse into unknown element "' + index + '", parent: ' + el;
            }

            while (traversal.length > 0) {
                el = el.childNodes[traversal.pop()];
                overrideDOMLevel1Event(el);
            }
        }
    }

function traverseToElement(traversal) {
  traversal = traversal ? traversal.slice() : traversal;

  if (traversal === null || traversal === void undefined) {
    return traversal;
  } else if (traversal === 'window') {
    return window;
  } else if (traversal.length === 0) {
    return document;
  }

  // Get document object from frame hierarchy first
  var index;
  var el = window.top;
  while(traversal.length > 0 && (index = traversal.pop()) !== -1){
	 el = el.frames[index];
  }
  el = el.document;
  
  // Get dom element from dom hierarchy
  if(traversal.length > 0){
	  var index = traversal.pop();
	  if (index === 'head') {
	    el = el.head;
	  } else if (index === 'body') {
	    el = el.body;
	  } else if(el.childNodes.length > index){
		el = el.childNodes[index];
	  }else{
		throw 'Cannot traverse into unknown element "' + index + '", parent: ' + el;
	  }

	  while (traversal.length > 0) {
	    el = el.childNodes[traversal.pop()];
	  }
  }

  return el;
}

Reanimator.util = Reanimator.util || {};
Reanimator.util.event = Reanimator.util.event || {};
Reanimator.util.event.serialization = {
  serialize: serialize,
  traverseToElement: traverseToElement,
  domTraverseToElement:domTraverseToElement
};

module.exports = Reanimator.util.event.serialization;

});

define('reanimator/util/event/create',['require','exports','module','../../core'],function (require, exports, module) {
/* vim: set et ts=2 sts=2 sw=2: */
var Reanimator = require('../../core');

var eventCreators = {
  Event: function (details) {
    var event = document.createEvent('Event');

    event.initEvent(details.type, details.bubbles, details.cancelable);

    event._reanimator = {
      toFix: ['timeStamp']
    };

    return event;
  },

  UIEvent: function (details) {
    var event = document.createEvent('UIEvent');

    /*
     * initUIEvent(type, canBubble, cancelable, view, detail)
     */
    event.initUIEvent(details.type, details.bubbles, details.cancelable,
      global, details.detail);

    event._reanimator = {
      toFix: ['timeStamp']
    };

    return event;
  },

  FocusEvent: function (details) {
    var event = document.createEvent('FocusEvent');

    /*
     * initFocusEvent(eventType, canBubble, cancelable, viewArg, detailArg,
     *   relatedTargetArg)
     */
    event.initFocusEvent(details.type, details.bubbles, details.cancelable,
      global, details.detail,
      details.relatedTarget);

    event._reanimator = {
      toFix: ['timeStamp']
    };

    return event;
  },

  MouseEvent: function (details) {
    var event = document.createEvent('MouseEvent');

    /*
     * event.initMouseEvent(type, canBubble, cancelable, view, detail,
     *   screenX, screenY, clientX, clientY, ctrlKey, altKey, shiftKey,
     *   metaKey, button, relatedTarget);
     */
    event.initMouseEvent(details.type, details.bubbles, details.cancelable,
      global, details.detail,
      details.screenX, details.screenY, details.clientX, details.clientY,
      details.ctrlKey, details.altKey, details.shiftKey, details.metaKey, 
      details.button, details.relatedTarget);

    event._reanimator = {
      toFix: ['timeStamp']
    };

    return event;
  },

  KeyboardEvent: function (details) {
    var event = document.createEvent('KeyboardEvent');
    var modifiers = [];

    if (details.altKey) {
      modifiers.push('Alt');
    }

    if (details.ctrlKey) {
      modifiers.push('Control');
    }

    if (details.metaKey) {
      modifiers.push('Meta');
    }
    
    if (details.shiftKey) {
      modifiers.push('Shift');
    }
   
   // Fill the property "keyCode" and "which", otherwise, the keyboard event (like arrow down) can not be created and dispatched successfully.
    Object.defineProperty(event, 'keyCode', {
        get : function() {
            return this.keyCodeVal;
        }
   });     
   Object.defineProperty(event, 'which', {
        get : function() {
            return this.keyCodeVal;
        }
   });     
   
   event.keyCodeVal = details.keyCode;


    if (document.attachEvent) {
      // IE

      /*
       * initKeyboardEvent(eventType, canBubble, cancelable, viewArg,
       *   keyArg, locationArg, modifiersListArg, repeat, locale);
       */
      // FIXME: is there a better way to detect IE here?
      event.initKeyboardEvent(details.type,
        details.bubbles, details.cancelable, global,
        details.keyCode, details.location,
        modifiers.join(' '), details.repeat, '');
    } else if (event.initKeyboardEvent) {
      // WebKit and Opera?
      /*
      void initKeyboardEvent(
        in DOMString typeArg,
        in boolean canBubbleArg,
        in boolean cancelableArg,
        in views::AbstractView viewArg,
        in DOMString charArg,
        in DOMString keyArg,
        in unsigned long locationArg,
        in DOMString modifiersListArg,
        in boolean repeat,
        in DOMString localeArg // not implemented in WebKit
      )
      */
      event.initKeyboardEvent(details.type,
        details.bubbles, details.cancelable, global,
        details.charCode, details.keyCode, details.location,
        modifiers.join(' '), details.repeat);
    } else if (event.initKeyEvent) {
      // Firefox

      /*
       * initKeyEvent(type, bubbles, cancelable, viewArg, ctrlKeyArg,
       *   altKeyArg, shiftKeyArg, metaKeyArg, keyCodeArg, charCodeArg)
       */
      event.initKeyEvent(details.type,
        details.bubbles, details.cancelable, global,
        details.ctrlKey, details.altKey, details.shiftKey, details.metaKey, 
        details.keyCode, details.charCode);
    } else {
      // init as Event
      event.initEvent(details.type, details.bubbles, details.cancelable);
    }

    event._reanimator = {
      toFix: [
        'which', 'altGraphKey', 'metaKey', 'altKey', 'shiftKey', 'ctrlKey',
        'location', 'keyIdentifier', 'pageY', 'pageX', 'layerY',
        'layerX', 'charCode', 'keyCode', 'detail', 'view', 'clipboardData',
        'timeStamp'
      ]
    };

    return event;
  }
};

Reanimator.util = Reanimator.util || {};
Reanimator.util.event = Reanimator.util.event || {};

Reanimator.util.event.create = function createEvent(type, details) {
  var creator = eventCreators[type];
  
  if (!creator) {
    throw 'No replayer for DOM event of type "' + type + '"';
  }

  return creator(details);
};

module.exports = Reanimator.util.event.create;

});

define('reanimator/plugins/dom',['require','exports','module','../core','../util/event/serialization','../util/event/create'],function (require, exports, module) {
/* vim: set et ts=2 sts=2 sw=2: */
var Reanimator = require('../core');
var serialization = require('../util/event/serialization');
var create = require('../util/event/create');

var _native, _log;

// FIXME: should be broken out to a separate module

function dom_replay(entry) {
  var details = entry.details.details;
  var relatedTarget = details.relatedTarget;
  // set related target in entry before creation or creating the event will fail
  details.relatedTarget =
    serialization.traverseToElement(details.relatedTarget);

  var event = create(entry.details.type, entry.details.details);
  // restore related target in entry
  details.relatedTarget = relatedTarget;

  event._reanimator.entry = entry;
  var target = serialization.traverseToElement(details.target);
  serialization.domTraverseToElement(details.target);
  
  target.value = details._reanimator.value;
  target.dispatchEvent(event);
  if(entry.details.type === 'KeyboardEvent' && document.activeElement != target){
	  // In some application, the focus will not always be in the current element with keyboard input (e.g. changing focus is very fast in the application).
	  // This may result in replay error. Force to focus after each keyboard input. 
	  target.focus();
  }
}

function captureDomEvents(event,plog){
    var originalEvent = event;
    var entry;
  
    /*
     * Only log the event if it is not synthetic and hasn't been logged yet.
     *
     * - Events from `$.fn.trigger` do not have an `originalEvent` property.
     * - Events from `$.fn.simulate` do not have an `originalEvent.type`
     *   property.
     * - Events from `document.createEvent` will have `_reanimator.synthetic`
     *   set to `true`
     * - Events that have already been captured will have `_reanimator.captured`
     *   set to `true`
     */
    if (originalEvent && originalEvent.type && (
        !originalEvent._reanimator ||
        (
          !originalEvent._reanimator.captured &&
          !originalEvent._reanimator.synthetic
        )
      )
    ) {
      originalEvent._reanimator = originalEvent._reanimator || {};
      originalEvent._reanimator.captured = true;
      originalEvent._reanimator.value =
        (originalEvent.target || originalEvent.srcElement).value;

      entry = {
        time: _native.Date.now(),
        type: 'dom',
        fun: [],
        details: {}
      };

      if (global.MouseEvent && originalEvent instanceof MouseEvent) {
        entry.details.type = 'MouseEvent';
        
        if(originalEvent.target.tagName.toUpperCase() == 'SELECT'.toUpperCase()){
        	// If it is a mouse event on a <select> element, ignore this event, as we also record "change" event.
        	return;
        }
      } else if (global.KeyboardEvent && 
          originalEvent instanceof KeyboardEvent
      ) {
        entry.details.type = 'KeyboardEvent';
      } else if (global.UIEvent && originalEvent instanceof UIEvent) {
        entry.details.type = 'UIEvent';
      } else if (global.CustomEvent && originalEvent instanceof CustomEvent) {
        entry.details.type = 'CustomEvent';
      } else {
        entry.details.type = 'Event';
      }

      entry.details.details = serialization.serialize(originalEvent);

      //console.log("reanimator length" + _log.events.length);

      //console.log("reanimator "+ JSON.stringify(entry.details));

      plog.events.push(entry);
    }

}

function getCaptureOnHandlerListener(listener){
    return function(event){
        if(typeof event._reanimator.replay ==='undefined'){
            event._reanimator.replay = true;
            if(event.type === "DOMContentLoaded"){
                var len = Reanimator.log.events.length;
                Reanimator.log.events[len-1].fun.push(listener.toString());
            }else{
                event._reanimator.entry.fun.push(listener.toString());
                Reanimator.log.events.push(event._reanimator.entry);
            }

        }else{
            var len = Reanimator.log.events.length;
            Reanimator.log.events[len-1].fun.push(listener.toString());
        }
        //captureDomEvents(event,Reanimator.log);
        listener.apply(this, Array.prototype.slice.call(arguments));
    }
}

Reanimator.plug('dom', {
  init: function init(native) {
    _native = native;
    Node.prototype.origElementEventListener = Node.prototype.addEventListener;
    Node.prototype.origRvEventListener = Node.prototype.removeEventListener;
  },
  capture: function (log, config) {

      _log = log;


      // Capture all mouse events registered by addEventListener or dom properties (event type: MouseEvent)
      // Do not capture  mouseenter, mouseleave, mousemove, mouseout, mouseover event, because there will be too many unrelated events.
      window.addEventListener('click', function(plog){return function(e){captureDomEvents(e,plog);};}(_log), true);
      window.addEventListener('dblclick', function(plog){return function(e){captureDomEvents(e,plog);};}(_log), true);
      window.addEventListener('mousedown', function(plog){return function(e){captureDomEvents(e,plog);};}(_log), true);
      window.addEventListener('mouseup', function(plog){return function(e){captureDomEvents(e,plog);};}(_log), true);

      //window.addEventListener('mouseenter', function(plog){return function(e){captureDomEvents(e,plog);};}(_log), true);
      //window.addEventListener('mouseleave', function(plog){return function(e){captureDomEvents(e,plog);};}(_log), true);
      //window.addEventListener('mousemove', function(plog){return function(e){captureDomEvents(e,plog);};}(_log), true);

      window.addEventListener('mouseout', function(plog){return function(e){captureDomEvents(e,plog);};}(_log), true);
      window.addEventListener('mouseover', function(plog){return function(e){captureDomEvents(e,plog);};}(_log), true);

      // Capture focus and blur event registered by addEventListener or dom properties (event type: Event)
      // window.addEventListener('focus', captureDomEvents, true);
      // window.addEventListener('blur', captureDomEvents, true);

      // Capture all keyboard events registered by addEventListener or dom properties (event type: KeyboardEvent)
      window.addEventListener('keydown', function(plog){return function(e){captureDomEvents(e,plog);};}(_log), true);
      window.addEventListener('keypress', function(plog){return function(e){captureDomEvents(e,plog);};}(_log), true);
      window.addEventListener('keyup', function(plog){return function(e){captureDomEvents(e,plog);};}(_log), true);

      // For other DOM events, will add support while encountered in subjects
      window.addEventListener('change', function(plog){return function(e){captureDomEvents(e,plog);};}(_log), true);
  },

  beforeReplay: function (log, config) {
	_log = log;


    Node.prototype.addEventListener= function(type,listener,useCapture){
          var origListener = listener;
          listener = getCaptureOnHandlerListener(origListener);
          Node.prototype.origElementEventListener.call(this,type,listener,useCapture);

          //added by guoquan
          if(this.saveListenerArray == null){
              this.saveListenerArray = new Array();
          }
          this.saveListenerArray.push([origListener,listener]);

          //return listener;
    }

    Node.prototype.removeEventListener = function(type,listener,useCapture){
        for(var i =0; i< this.saveListenerArray.length;++i){
            if(listener === this.saveListenerArray[i][0]){
                listener = this.saveListenerArray[i][1];
            }
        }
        /*if(this.listenermap){
            listener = this.listenermap.get(listener);
        }*/
        Node.prototype.origRvEventListener.call(this,type,listener,useCapture);
    }

      var origSetAttri = Element.prototype.setAttribute;
      Element.prototype.setAttribute= function(attr, value){
          var k;
          var flag = false;
          var validEvents = getLevel1Event(this);
          for(k =0; k< validEvents.length; k++){
              if( validEvents[k] === attr){
                  flag = true;
              }
          }
          if(flag){
              /*"use strict";
              var name = 'foo';
              var func = new Function("return function " +name + "(){"+value+"}")();*/
              /*function foo(){
                  eval(value);
              }*/
              /*var str = "var fn = function(){" +value+"}";
              eval(str);*/
              var fn = new Function(value);
              this[attr] = fn;
          }else{
              origSetAttri.apply(this,arguments);
          }
      }
    /* NOP */
  },
  replay: dom_replay,
  cleanUp: function jquery_cleanUp() {_log = null; }
});

});

define('reanimator/plugins/dom-content-loaded',['require','exports','module','../core','../util/event/serialization','../util/event/create'],function (require, exports, module) {
/* vim: set et ts=2 sts=2 sw=2: */
/*jshint evil:true */
var Reanimator = require('../core');
var serialization = require('../util/event/serialization');
var createEvent = require('../util/event/create');

var _native;

var listeners = [];
function replayAddEventListener(type, listener, useCapture) {
  var args = Array.prototype.slice.call(arguments);
  type = type + '';

  if (type.toLowerCase() === 'domcontentloaded') {
    listeners.push({
      type: type,
      listener: listener,
      useCapture: useCapture
    });
  } else {
    origAddEventListener.apply(document, args);
  }
}

function replayRemoveEventListener(type, listener, useCapture) {
  var args = Array.prototype.slice.call(arguments);
  type = type + '';

  if (type.toLowerCase() === 'domcontentloaded') {
    listeners = listeners.filter(function (record) {
      return record.listener !== listener || record.useCapture !== useCapture;
    });
  } else {
    origRemoveEventListener.apply(document, args);
  }
}

var fired = false;
function beforeReplay(log, config) {

  origAddEventListener.call(document,'DOMContentLoaded',function(){fired = true;});
  /*document.addEventListener('DOMContentLoaded', function () {
    fired = true;
  });*/

  //document.addEventListener = replayAddEventListener;
  //document.removeEventListener = replayRemoveEventListener;
}

function replay(entry, done) {
  function fire(entry, done) {
    /*document.addEventListener = origAddEventListener;
    // add the queued event listeners
    listeners.forEach(function addQueuedEventListeners(listener) {
      document.addEventListener(
        'DOMContentLoaded', listener.listener, listener.useCapture);
    });*/

    // fire the event
    var event = createEvent('Event', entry.details.details);
    document.dispatchEvent(event);
    done();
  }

  if (fired) {
    fire(entry, done);
  } else {
    origAddEventListener.
      call(document, 'DOMContentLoaded', function onDomContentLoaded() {
        origRemoveEventListener.
          call(document, 'DOMContentLoaded', onDomContentLoaded, false);
        fire(entry, done);
      });
  }
}

function capture(log, config) {
  // capture DOMContentLoaded exactly once
  document.addEventListener('DOMContentLoaded', function onDomContentLoaded(e) {
    log.events.push({
      time: _native.Date.now(),
      type: 'dom-content-loaded',
      fun: [],
      details: {
        details: serialization.serialize(event)
      }
    });

    document.removeEventListener('DOMContentLoaded', onDomContentLoaded);
  });
}

Reanimator.plug('dom-content-loaded', {
  init: function init(native) {
    _native = native;
    origAddEventListener = document.addEventListener; //can ensure it is the original
    origRemoveEventListener = document.removeEventListener;
  },
  capture: capture,
  beforeReplay: beforeReplay,
  replay: replay,
  cleanUp: function cleanUp() {
    document.addEventListener = origAddEventListener;
    document.removeEventListener = origRemoveEventListener;
  }
});

});

define('reanimator/util/event/synthetic',['require','exports','module','../../core'],function (require, exports, module) {
/*jslint es5: true */
/**
 * Synthetic events for working around browsers that don't provide
 * XMLHttpRequestProgressEvent
 *
 * This module largely consists of portions of /lib/jsdom/level2/events.js from
 * jsdom, modified to pass jshint, use Object.create for inheritance, and adhere
 * to the Events Level 3 ordering.
 *
 * jsdom is made available under the MIT license:
 * Copyright (c) 2010 Elijah Insua
 *
 * Permission is hereby granted, free of charge, to any person
 * obtaining a copy of this software and associated documentation
 * files (the "Software"), to deal in the Software without
 * restriction, including without limitation the rights to use,
 * copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the
 * Software is furnished to do so, subject to the following
 * conditions:
 *
 * The above copyright notice and this permission notice shall be
 * included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
 * EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES
 * OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
 * NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT
 * HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
 * WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
 * FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR
 * OTHER DEALINGS IN THE SOFTWARE.
 */
var Reanimator = require('../../core');
var events = {};

events.EventException = function() {
    if (arguments.length > 0) {
        this._code = arguments[0];
    } else {
        this._code = 0;
    }
    if (arguments.length > 1) {
        this._message = arguments[1];
    } else {
        this._message = "Unspecified event type";
    }
    Error.call(this, this._message);
    if (Error.captureStackTrace) {
        Error.captureStackTrace(this, events.EventException);
    }
};
events.EventException.prototype = Object.create(Error.prototype, {
    UNSPECIFIED_EVENT_TYPE_ERR : { value: 0 },
    code: { get: function code() { return this._code;} }
});

events.Event = function(eventType) {
    this._eventType = eventType;
    this._type = null;
    this._bubbles = null;
    this._cancelable = null;
    this._target = null;
    this._currentTarget = null;
    this._eventPhase = null;
    this._timeStamp = null;
    this._preventDefault = false;
    this._stopPropagation = false;
};
events.Event.prototype = {
    initEvent: function(type, bubbles, cancelable) {
        this._type = type;
        this._bubbles = bubbles;
        this._cancelable = cancelable;
    },
    preventDefault: function() {
        if (this._cancelable) {
            this._preventDefault = true;
        }
    },
    stopPropagation: function() {
        this._stopPropagation = true;
    },
    CAPTURING_PHASE : 1,
    AT_TARGET       : 2,
    BUBBLING_PHASE  : 3,
    get eventType() { return this._eventType; },
    get type() { return this._type; },
    get bubbles() { return this._bubbles; },
    get cancelable() { return this._cancelable; },
    get target() { return this._target; },
    get currentTarget() { return this._currentTarget; },
    get eventPhase() { return this._eventPhase; },
    get timeStamp() { return this._timeStamp; }
};


events.UIEvent = function(eventType) {
    events.Event.call(this, eventType);
    this.view = null;
    this.detail = null;
};
events.UIEvent.prototype = Object.create(events.Event.prototype, {
    initUIEvent: function(type, bubbles, cancelable, view, detail) {
        this.initEvent(type, bubbles, cancelable);
        this.view = view;
        this.detail = detail;
    },
});

events.MouseEvent = function(eventType) {
    events.UIEvent.call(this, eventType);
    this.screenX = null;
    this.screenY = null;
    this.clientX = null;
    this.clientY = null;
    this.ctrlKey = null;
    this.shiftKey = null;
    this.altKey = null;
    this.metaKey = null;
    this.button = null;
    this.relatedTarget = null;
};
events.MouseEvent.prototype = Object.create(events.UIEvent.prototype, {
    initMouseEvent: { value: function(type,
                               bubbles,
                               cancelable,
                               view,
                               detail,
                               screenX,
                               screenY,
                               clientX,
                               clientY,
                               ctrlKey,
                               altKey,
                               shiftKey,
                               metaKey,
                               button,
                               relatedTarget) {
            this.initUIEvent(type, bubbles, cancelable, view, detail);
            this.screenX  = screenX;
            this.screenY  = screenY;
            this.clientX  = clientX;
            this.clientY  = clientY;
            this.ctrlKey  = ctrlKey;
            this.shiftKey  = shiftKey;
            this.altKey  = altKey;
            this.metaKey  = metaKey;
            this.button  = button;
            this.relatedTarget  = relatedTarget;
        }
    }
});

events.MutationEvent = function(eventType) {
    events.Event.call(this, eventType);
    this.relatedNode = null;
    this.prevValue = null;
    this.newValue = null;
    this.attrName = null;
    this.attrChange = null;
};
events.MutationEvent.prototype = Object.create(events.Event.prototype, {
    initMutationEvent: { value: function(type,
                                  bubbles,
                                  cancelable,
                                  relatedNode,
                                  prevValue,
                                  newValue,
                                  attrName,
                                  attrChange) {
            this.initEvent(type, bubbles, cancelable);
            this.relatedNode = relatedNode;
            this.prevValue = prevValue;
            this.newValue = newValue;
            this.attrName = attrName;
            this.attrChange = attrChange;
        }
    },
    MODIFICATION : { value: 1 },
    ADDITION     : { value: 2 },
    REMOVAL      : { value: 3 }
});

events.EventTarget = function() {};

events.EventTarget.getListeners = function getListeners(target, type, capturing) {
    var listeners = target._listeners &&
        target._listeners[type] &&
        target._listeners[type][capturing] || [];
    if (!capturing) {
        var traditionalHandler = target['on' + type];
        if (traditionalHandler) {
            listeners.push(traditionalHandler);
        }
    }
    return listeners;
};

events.EventTarget.dispatch = function dispatch(event, iterator, capturing) {
    var listeners,
        currentListener,
        target = iterator();

    while (target && !event._stopPropagation) {
        listeners = events.EventTarget.getListeners(target, event._type, capturing);
        currentListener = 0;
        while (currentListener < listeners.length) {
            event._currentTarget = target;
            try {
              listeners[currentListener].call(target, event);
            } catch (e) {
              target.raise(
                'error', "Dispatching event '" + event._type + "' failed",
                {error: e, event: event}
              );
            }
            currentListener++;
        }
        target = iterator();
    }
    return !event._stopPropagation;
};

events.EventTarget.forwardIterator = function forwardIterator(list) {
  var i = 0, len = list.length;
  return function iterator() { return i < len ? list[i++] : null; };
};

events.EventTarget.backwardIterator = function backwardIterator(list) {
  var i = list.length;
  return function iterator() { return i >=0 ? list[--i] : null; };
};

events.EventTarget.singleIterator = function singleIterator(obj) {
  var i = 1;
  return function iterator() { return i-- ? obj : null; };
};

events.EventTarget.prototype = {
    addEventListener: function(type, listener, capturing) {
        this._listeners = this._listeners || {};
        var listeners = this._listeners[type] || {};
        capturing = (capturing === true);
        var capturingListeners = listeners[capturing] || [];
        for (var i=0; i < capturingListeners.length; i++) {
            if (capturingListeners[i] === listener) {
                return;
            }
        }
        capturingListeners.push(listener);
        listeners[capturing] = capturingListeners;
        this._listeners[type] = listeners;
    },

    removeEventListener: function(type, listener, capturing) {
        var listeners  = this._listeners && this._listeners[type];
        if (!listeners) return;
        var capturingListeners = listeners[(capturing === true)];
        if (!capturingListeners) return;
        for (var i=0; i < capturingListeners.length; i++) {
            if (capturingListeners[i] === listener) {
                capturingListeners.splice(i, 1);
                return;
            }
        }
    },

    dispatchEvent: function(event) {
        /*jshint eqnull: true, eqeqeq: false */
        if (event == null) {
            throw new events.EventException(0, "Null event");
        }
        if (event._type == null || event._type == "") {
            throw new events.EventException(0, "Uninitialized event");
        }

        var targetList = [];

        event._target = this;

        //per the spec we gather the list of targets first to ensure
        //against dom modifications during actual event dispatch
        var target = this,
            targetParent = target._parentNode;
        while (targetParent) {
            targetList.push(targetParent);
            target = targetParent;
            targetParent = target._parentNode;
        }
        targetParent = target._parentWindow;
        if (targetParent) {
            targetList.push(targetParent);
        }

        var iterator = events.EventTarget.backwardIterator(targetList);

        event._eventPhase = event.CAPTURING_PHASE;
        if (!events.EventTarget.dispatch(event, iterator, true)) return event._preventDefault;

        iterator = events.EventTarget.singleIterator(event._target);
        event._eventPhase = event.AT_TARGET;
        if (!events.EventTarget.dispatch(event, iterator, false)) return event._preventDefault;

        if (event._bubbles && !event._stopPropagation) {
            var i = 0;
            iterator = events.EventTarget.forwardIterator(targetList);
            event._eventPhase = event.BUBBLING_PHASE;
            events.EventTarget.dispatch(event, iterator, false);
        }

        return event._preventDefault;
    }

};

Reanimator.util = Reanimator.util || {};
Reanimator.util.event = Reanimator.util.event || {};

Reanimator.util.event.synthetic = module.exports = events;

});

define('reanimator/plugins/xhr',['require','exports','module','../core','../util/event/serialization','../util/event/create','../util/event/synthetic'],function (require, exports, module) {
/* vim: set et ts=2 sts=2 sw=2: */
var Reanimator = require('../core');
var serialization = require('../util/event/serialization');
var create = require('../util/event/create');
var synthetic = require('../util/event/synthetic');
var iface = getInterface();

var _native, _log,  handlers;
Reanimator.xhrs = [];

function onReadyStateChange(event) {
  // Only log the event if someone is listening, it is not synthetic, and it
  // hasn't been logged yet.
  // - If no one is listening, getListeners() will return an empty array
  // - Events from `document.createEvent` will have `_reanimator.synthetic`
  //   set to `true`
  // - Events that have already been captured will have `_reanimator.captured`
  //   set to `true`
  var listenerCount = synthetic.EventTarget.
      getListeners(this, 'readystatechange', false).length +
    synthetic.EventTarget.getListeners(this, 'readystatechange', true);
  var entry;

  if (listenerCount > 0 && event && (
      !event._reanimator ||
      (!event._reanimator.captured && !event._reanimator.synthetic)
    )
  ) {
    event._reanimator = event._reanimator || {};
    event._reanimator.captured = true;

    entry = {
        type: 'xhr',
        time: _native.Date.now(),
        details: {
          id: this._reanimator.id,
          type: 'Event',
          details: serialization.serialize(event)
        }
    };

    entry.details.details.target = this._reanimator.id;
    entry.details.details.currentTarget = this._reanimator.id;
    entry.details.details.srcElement = this._reanimator.id;

    //console.log("xhr length " + _log.events.length);

    _log.events.push(entry);

    // re-raise the event
    var fakeEvent = new synthetic.Event();
    fakeEvent.initEvent(event.type, event.bubbles, event.cancelable);

    for (var k in event) {
      if (!(k in fakeEvent)) {
        fakeEvent[k] = event[k];
      }
    }

    fakeEvent._reanimator = event._reanimator;
    fakeEvent._timeStamp = event.timeStamp;

    this.dispatchEvent(fakeEvent);
  }
}

function linkProperty(name) {
  Object.defineProperty(this, name, {
    get: function () {
      var result;

      _log.xhr.instances[this._reanimator.id][name] =
        _log.xhr.instances[this._reanimator.id][name] || [];
      try {
        result = this._value[name];
        _log.xhr.instances[this._reanimator.id][name].push({
          type: 'result',
          value: result
        });

        return result;
      } catch (e) {
        _log.xhr.instances[this._reanimator.id][name].push({
          type: 'error',
          value: {
            message: e.message,
            code: e.code,
            name: e.name
          }
        });
        throw e;
      }
    },
    set: function (value) {
      this._value[name] = value;
    }
  });
}

function XMLHttpRequest_capture() {
  synthetic.EventTarget.call(this);

  this._value = new _native.XMLHttpRequest();
  this._reanimator = {
    id: _log.xhr.instances.length
  };
  var instance = { id: this._reanimator.id };
  _log.xhr.instances.push(instance);
  // XXX: not sure we need this here
  //xhrs.push(this);

  this._value.
    addEventListener('readystatechange', onReadyStateChange.bind(this), false);

  // link properties
  iface.instance.properties.filter(function (name) {
    return name.indexOf('on') !== 0;
  }).forEach(linkProperty, this);

  // link methods
  iface.instance.methods.forEach(function (name) {
    this[name] = getMethodWrapper(name);
  }, this);
}

XMLHttpRequest_capture.prototype =
  Object.create(synthetic.EventTarget.prototype, {
  });

iface.prototype.methods.forEach(function (name) {
  if (!(name in synthetic.EventTarget.prototype)) {
    XMLHttpRequest_capture.prototype[name] = getMethodWrapper(name);
  }
});

iface.prototype.properties.forEach(function (name) {
  XMLHttpRequest_capture.prototype[name] = XMLHttpRequest[name];
});


function getMethodWrapper(name) {
  return function () {
    var args = Array.prototype.slice.call(arguments);
    var result;

    _log.xhr.instances[this._reanimator.id][name] =
      _log.xhr.instances[this._reanimator.id][name] || [];

    try {
      result = this._value[name].apply(this._value, args);
        //modified by guoquan
       var funName = name+"("+args.join()+")";
      _log.xhr.instances[this._reanimator.id][name].push({
        type: 'result',
        //fun: funName,
        value: result

      });

      return result;
    } catch (e) {
      _log.xhr.instances[this._reanimator.id][name].push({
        type: 'error',
        value: {
          message: e.message,
          code: e.code,
          name: e.name
        }
      });
      throw e;
    }
  };
}

['DONE', 'HEADERS_RECEIVED', 'LOADING', 'OPENED', 'SENT'].forEach(function (k) {
  XMLHttpRequest_capture[k] = window.XMLHttpRequest[k];
});

var statusDescriptor = {
    get: function () {
      this._assertReadyState(
        XMLHttpRequest.UNSENT, XMLHttpRequest.HEADERS_RECEIVED);
      return this._status;
    }
  };
var statusTextDescriptor = {
    get: function () {
      this._assertReadyState(
        XMLHttpRequest.UNSENT, XMLHttpRequest.HEADERS_RECEIVED);
      return this._statusText;
    }
  };

function XMLHttpRequest_replay() {
    //modified by guoquan
    var instance_xhr = {};
    var k;
    this._reanimator =  _log.xhr.instances.pop();
    for(k in this._reanimator){
        if(this._reanimator[k] instanceof Array){
            instance_xhr[k]=[];
        }
    }
    instance_xhr.id = this._reanimator.id;
    Reanimator.log.xhr.instances.push(instance_xhr);

   //modified by guoquan
    //Reanimator.log.xhr.instances.push(JSON.parse(JSON.stringify(instance_xhr)));


  Object.keys(this._reanimator).forEach(function (k) {
    if (this._reanimator[k] instanceof Array) {
      this._reanimator[k] = this._reanimator[k].reverse();
    }
  }, this);
  // Only store xhr instances to topmost window
  window.top.Reanimator.xhrs.push(this);

  // link properties
  _log.xhr.iface.instance.properties.forEach(function (name) {
    if (name.indexOf('on') === 0) {
      name = name.slice(2);
      Object.defineProperty(this, '_on' + name, {
        enumerable: false,
        value: null
      });
      Object.defineProperty(this, 'on' + name, {
        enumerable: true,
        get: function () {
          return this['_on' + name];
        },
        set: function (fn) {
          if (this['_on' + name]) {
            this.removeEventListener(name, this['_on' + name]);
            this['_on' + name] = null;
          }

          if (typeof fn === 'function') {
            this.addEventListener(name, fn);
            this['_on' + name] = fn;
          }
        }
      });
      return;
    } else {
      Object.defineProperty(this, name, {
        enumerable: true,
        get: function () {
          var result = this._reanimator[name].pop();
           //modified by guoquan
           instance_xhr[name].push(result);

          var error;

          if (result.type === 'error') {
            error = new Error(result.value.message);
            error.code = result.value.code;
            error.name = result.value.name;
            throw error;
          }
          
          return result.value;
        },
        set: function (value) {
          /* NOP */
        }
      });
    }
  }, this);

  // link methods
  _log.xhr.iface.instance.methods.forEach(function (name) {
    this[name] = replayMethodOrProperty.bind(this, name);
  }, this);
}

['DONE', 'HEADERS_RECEIVED', 'LOADING', 'OPENED', 'SENT'].forEach(function (k) {
  XMLHttpRequest_replay[k] = window.XMLHttpRequest[k];
});

function replayMethodOrProperty(name) {
  // Note: modified by guoquan
  // from this function we can get the arguments

  //not sure whether this function will be invoked
  var len = Reanimator.log.xhr.instances.length;
  var xhr_ins= Reanimator.log.xhr.instances[len-1];


  var result = this._reanimator[name].pop();

  xhr_ins[name].push(result);

  var error;

  if (result.type === 'error') {
    error = new Error(result.value.message);
    error.code = result.value.code;
    error.name = result.value.name;
    throw error;
  }
  
  return result.value;
}

function getInterface() {
  var iface = {
    instance: {
      methods: [],
      properties: []
    },
    prototype: {
      methods: [],
      properties: []
    }
  };
  var xhr = new XMLHttpRequest();
  var k;

  iface.instance.properties = Object.keys(xhr).filter(function (k) {
    if (typeof xhr[k] === 'function') {
      iface.instance.methods.push(k);
      return false;
    }

    return true;
  });

  iface.prototype.properties =
    Object.keys(xhr.constructor.prototype).filter(function (k) {
      if (typeof xhr.constructor.prototype[k] === 'function') {
        iface.prototype.methods.push(k);
        return false;
      }

      return true;
    });

  return iface;
}

Reanimator.plug('xhr', {
  init: function init(native) {
    _native = native;
    _native.XMLHttpRequest = window.XMLHttpRequest;
  },
  capture: function xhr_capture(log, config, isTopWindow) {
    _log = log;

    if(isTopWindow){
    	 _log.xhr = {
    		iface: iface,
    		instances: []
    	};
    	 
    	window.XMLHttpRequest = XMLHttpRequest_capture;
    }else{
    	window.XMLHttpRequest = window.top.XMLHttpRequest;
    }
  },
  beforeReplay: function (log, config, isTopWindow) {
    window._log = _log = log;
    
    if(isTopWindow){
    	 _log.xhr = _log.xhr || {
    	      iface: iface,
    	      instances: []
    	    };
        //modified by guoquan
        Reanimator.log.xhr.iface = iface;
        Reanimator.log.instance = [];

    	    _log.xhr.instances = (_log.xhr.instances || []).slice().reverse();
    	    var prototype = {};

    	    _log.xhr.iface.prototype.methods.forEach(function (name) {
    	      if (!(name in synthetic.EventTarget.prototype)) {
    	        prototype[name] = function replayMethodOrProperty() {

                  // Note by guoquan
                  // From this function we can get the argument of the function
                    var len = Reanimator.log.xhr.instances.length;
                    var xhr_inst = Reanimator.log.xhr.instances[len-1];
                    var args = Array.prototype.slice.call(arguments);
                    //modified by guoquan
                    var funName = name+"("+args.join()+")";

    	            var result = this._reanimator[name].pop();

                    result.fun = funName;
                    xhr_inst[name].push(result);

    	          var error;

    	          if (result.type === 'error') {
    	            error = new Error(result.value.message);
    	            error.code = result.value.code;
    	            error.name = result.value.name;
    	            throw error;
    	          }

    	          return result.value;
    	        };
    	      }
    	    });

    	    _log.xhr.iface.prototype.properties.forEach(function (name) {
    	      prototype[name] = XMLHttpRequest[name];
    	    });

    	    window.XMLHttpRequest = XMLHttpRequest_replay;
    	    XMLHttpRequest_replay.prototype =
    	      Object.create(synthetic.EventTarget.prototype, {});

    	    for (var k in prototype) {
    	      XMLHttpRequest_replay.prototype[k] = prototype[k];
    	    }

    	    handlers = {};
    	    Reanimator.xhrs = [];
    }else{
    	window.XMLHttpRequest = window.top.XMLHttpRequest;
    }
  },
  replay: function (entry) {
    var xhr = window.top.Reanimator.xhrs[entry.details.id];
    var details = entry.details.details;

    var event = new synthetic.Event();
    event.initEvent(details.type, details.bubbles, details.cancelable);

    for (var k in details) {
      if (!(k in event)) {
        event[k] = details[k];
      }
    }
    event._timestamp = details.timestamp;
    event._reanimator = details._reanimator;
    event.entry = entry;
    event.srcElement = xhr;

    xhr.dispatchEvent(event);
  },
  cleanUp: function xhr_cleanUp() {
      window.XMLHttpRequest = _native.XMLHttpRequest;
  }
});

});

define('reanimator/plugins/local-storage',['require','exports','module','../core'],function (require, exports, module) {
/* vim: set et ts=2 sts=2 sw=2: */
var Reanimator = require('../core');

var _native, _log;

/**
 * Capture all keys in localStorage in index order
 */
function snapshot(includeReanimator) {
  var len = localStorage.length;
  var state = [];

  for (var i = 0, k; i < len; i++) {
    k = localStorage.key(i);
    if (includeReanimator || k.indexOf('reanimator') !== 0) {
      state.push({
        key: k,
        value: localStorage[k]
      });
    }
  }

  return state;
}

/**
 * Set localStorage to state captured in a snapshot
 */
function restore(snapshot) {
  //localStorage.clear();
  for (var i = 0, len = snapshot.length; i < len; i++) {
    localStorage[snapshot[i].key] = snapshot[i].value;
  }
}

Reanimator.plug('local-storage', {
  init: function init(native) {
    _native = native;
    _native.localStorage_getItem = window.localStorage.getItem;
    _native.localStorage_setItem = window.localStorage.setItem;
    _native.localStorage_clear = window.localStorage.clear;
  },
  capture: function xhr_capture(log, config, isTopWindow) {
    _log = log;

    if(isTopWindow){
    	 _log.localStorage = {
    		        state: snapshot(false)
    		    };
    }
  },
  beforeReplay: function (log, config, isTopWindow) {
    var k;

    _log = log;
    
    if(isTopWindow){
    	_log.localStorage = _log.localStorage || {};
    	_log.localStorage.preReplayState = snapshot(true);
    	_log.localStorage.state = _log.localStorage.state || []; 
    	restore(_log.localStorage.state);
    }
  },
  cleanUp: function xhr_cleanUp() {
    restore(_log.localStorage.preReplayState || []);
    window.localStorage.getItem = _native.localStorage_getItem;
    window.localStorage.setItem = _native.localStorage_setItem;
    window.localStorage.clear = _native.localStorage_clear;
  }
});

});

define('reanimator',['require','exports','module','reanimator/plugins/date','reanimator/plugins/interrupts','reanimator/plugins/random','reanimator/plugins/document-create-event','reanimator/plugins/dom','reanimator/plugins/dom-content-loaded','reanimator/plugins/xhr','reanimator/plugins/local-storage'],function (require, exports, module) {
/* vim: set et ts=2 sts=2 sw=2: */

// JavaScript standard library
require('reanimator/plugins/date');
require('reanimator/plugins/interrupts');
require('reanimator/plugins/random');

// DOM
require('reanimator/plugins/document-create-event');
require('reanimator/plugins/dom');
require('reanimator/plugins/dom-content-loaded');
require('reanimator/plugins/xhr');
require('reanimator/plugins/local-storage');

});
require("reanimator");
}(this))

