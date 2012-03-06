/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is peptest.
 *
 * The Initial Developer of the Original Code is
 *   The Mozilla Foundation.
 * Portions created by the Initial Developer are Copyright (C) 2011.
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Andrew Halberstadt <halbersa@gmail.com>
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 *
 ***** END LICENSE BLOCK ***** */

var EXPORTED_SYMBOLS = ['PepAPI'];
var results = {}; Components.utils.import('resource://pep/results.js', results);
var log = {};     Components.utils.import('resource://pep/logger.js', log);
var utils = {};   Components.utils.import('resource://pep/utils.js', utils);
var mozmill = {}; Components.utils.import('resource://mozmill/driver/mozmill.js', mozmill);
var securableModule = {};
Components.utils.import('resource://mozmill/stdlib/securable-module.js', securableModule);

const wm = Components.classes["@mozilla.org/appshell/window-mediator;1"]
                     .getService(Components.interfaces.nsIWindowMediator);
const ios = Components.classes["@mozilla.org/network/io-service;1"]
                      .getService(Components.interfaces.nsIIOService);
const profiler = Components.classes["@mozilla.org/tools/profiler;1"]
                           .getService(Components.interfaces.nsIProfiler);

function profiler_has_stackwalk() {
    var hh = Components.classes["@mozilla.org/network/protocol;1?name=http"].getService(Components.interfaces.nsIHttpProtocolHandler);
    var platform = hh["platform"];
    if (platform != "Macintosh") return false;
    var profilerFeatures = profiler.GetFeatures([]);
    return profilerFeatures.indexOf("stackwalk") !== -1;
}

/**
 * This is the API exposed to tests
 * Any properties of this object will be injected into test scope
 * under the 'pep' namespace.
 */
function PepAPI(test) {
  this.test = test;
  this.log = new Log(this.test.name);
  this.resultHandler = new results.ResultHandler(this.test.name);

  this.file = Components.classes["@mozilla.org/file/local;1"]
                        .createInstance(Components.interfaces.nsILocalFile);
  this.file.initWithPath(this.test.path);
}

/**
 * Performs an action during which responsiveness is measured
 */
PepAPI.prototype.performAction = function(actionName, func) {
  // initialize profiler
  let entries = get_pref_int("profiler.", "entries");
  let interval = get_pref_int("profiler.", "interval");
  let walkStack = get_pref_bool("profiler.", "walkstack");
  
  let out = {value:null};
  profiler.GetFeatures(out);
  let features = out.value; 

  try { // Trunk StartProfiler signature
    profiler.StartProfiler(entries, interval);
  } catch (e) { // Feature based signature that hasn't landed yet
    var selectedFeatures = [];
    if (profiler_has_stackwalk()) {
      selectedFeatures.push("stackwalk");
    }
    profiler.StartProfiler(entries, interval, selectedFeatures,
                           selectedFeatures.length);
  }
  if (walkStack && features.indexOf("SPS_WALK_STACK") != -1) {
    log.info('stack walker enabled');
    profiler.EnableFeature("SPS_WALK_STACK");
  }

  this.resultHandler.startAction(actionName);
  func();
  this.resultHandler.endAction();

  // stop profiler
  if (profiler.IsActive()) {
    let data = {value:null};
    profile = profiler.GetProfile(data);
    let lines = profile.split('\n');
    for (let i = 0; i < lines.length - 1; ++i) {
      log.info('PROFILE | ' + lines[i]);
    }
    log.info('Stopping profiler');
    profiler.StopProfiler();
    log.info('Profiler stopped.');
  }
};

/**
 * Returns the most recently used window of windowType
 */
PepAPI.prototype.getWindow = function(windowType) {
  if (windowType === undefined) {
    windowType = "navigator:browser";
  }
  return wm.getMostRecentWindow(windowType);
};

/**
 * Load a file on the local filesystem
 * module - path on the local file of the module to load (no extension)
 */
PepAPI.prototype.require = function(module) {
  let loader = new securableModule.Loader({
    rootPaths: [ios.newFileURI(this.file.parent).spec],
    defaultPrincipal: "system",
    globals: { Cc: Components.classes,
               Ci: Components.interfaces,
               Cr: Components.results,
               Cu: Components.utils,
               // mozmill scopes for compatibility with mozmill shared libraries
               // https://developer.mozilla.org/en/Mozmill_Tests/Shared_Modules
               mozmill: mozmill,
               // quick hack to keep backwards compatibility with mozmill 1.5.x
               elementslib: mozmill.findElement,
               findElement: mozmill.findElement,
               persisted: {}
             }
  });
  return loader.require(module);
};

/**
 * Sleep for a number of milliseconds
 */
PepAPI.prototype.sleep = function(milliseconds) {
  utils.sleep(milliseconds);
};

/**
 * Logging wrapper for tests
 */
function Log(testName) {
  this.testName = testName;
}
Log.prototype.debug = function(msg) {
  log.debug(this.testName + ' | ' + msg);
};
Log.prototype.info = function(msg) {
  log.info(this.testName + ' | ' + msg);
};
Log.prototype.warning = function(msg) {
  log.warning(this.testName + ' | ' + msg);
};
Log.prototype.error = function(msg) {
  log.error(this.testName + ' | ' + msg);
};


function get_pref_int(branch, node) {
    var prefs = Components.classes["@mozilla.org/preferences-service;1"]
                    .getService(Components.interfaces.nsIPrefService).getBranch(branch);
    
    var value = prefs.getIntPref(node);
    return value;
}

function get_pref_bool(branch, node, defaultValue) {
    var prefs = Components.classes["@mozilla.org/preferences-service;1"]
                    .getService(Components.interfaces.nsIPrefService).getBranch(branch);
    try {
        var value = prefs.getBoolPref(node);
    } catch (e) {
        if (defaultValue != null)
            defaultValue = false;
        return defaultValue;
    }
    return value;
}
