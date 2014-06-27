/*
(c) Copyright 2012 iOpus Software GmbH - http://www.iopus.com
*/
iMacros.jsplayer2 = (function() {
	var scope = {};
	Components.utils.import("resource://imacros/utils.js", scope);
	Components.utils.import("resource://gre/modules/jsdebugger.jsm", scope);
	var __loginf = scope.__loginf;
	var imns = scope.imns;

	function JS_Player() {
		let principal = Cc["@mozilla.org/systemprincipal;1"].createInstance(Ci.nsIPrincipal);
		let global = Components.utils.Sandbox(principal, {
			wantComponents: true
		});
		scope.addDebuggerToGlobal(global);
		this.dbg = new global.Debugger();
		this.dbg.onNewScript = function(script, func) {
			iMacros.jsplayer2.startLine = script.startLine;
		};
		this.dbg.onEnterFrame = function(frame) {
			if (!iMacros.jsplayer2.visualize || !frame.live || !frame.script) return;
			let offsets = frame.script.getAllOffsets();
			for (let i = 0; i < offsets.length; i++) {
				if (offsets[i]) {
					frame.script.setBreakpoint(offsets[i][0], iMacros.jsplayer2)
				}
			}
			frame.onStep = function() {
				return iMacros.jsplayer2.onStep();
			};
		};
		this.dbg.uncaughtExceptionHook = function(ex) {
			Components.utils.reportError(ex);
			return undefined;
		};
		this.shouldProceed = false;
		this.delay = 0;
		this.visualize = false;
		this.stopIsPending = false;
		this.pauseIsPending = false;
		this.paused = false;
		this.playing = false;
	};
	JS_Player.prototype.hit = function(frame) {
		if (frame.script) {
			let line = frame.script.getOffsetLine(frame.offset) - this.startLine + 1;
			iMacros.panel.highlightLine(line);
			var ct = imns.Cc["@mozilla.org/thread-manager;1"].getService(imns.Ci.nsIThreadManager).currentThread;
			this.shouldProceed = false;
			setTimeout(function() {
				iMacros.jsplayer2.shouldProceed = true;
			}, this.delay);
			while (!this.shouldProceed) ct.processNextEvent(true);
		} else {
			Components.utils.reportError("iMacros JS_Player, breakpoint handler: no frame.script!");
		}
	};
	JS_Player.prototype.onStep = function() {
		if (this.pauseIsPending) {
			this.pauseIsPending = false;
			this.paused = true;
			if (this.pauseCallback) {
				this.pauseCallback();
				this.pauseCallback = null;
			}
			var ct = imns.Cc["@mozilla.org/thread-manager;1"].getService(imns.Ci.nsIThreadManager).currentThread;
			while (this.paused && !this.stopIsPending) ct.processNextEvent(true);
		}
		if (this.stopIsPending) {
			this.stopIsPending = false;
			return null;
		}
	};
	JS_Player.prototype.play = function(code, name) {
		this.paused = false;
		let principal = Cc["@mozilla.org/systemprincipal;1"].createInstance(Ci.nsIPrincipal);
		var full_access = true;
		let sandbox = Components.utils.Sandbox(principal, {
			wantComponents: full_access
		});
		if (full_access) {
            sandbox.__defineGetter__("imns", function() {
                return imns;
            });
            sandbox.__defineGetter__("iMacros", function() {
                return iMacros;
            });
            sandbox.__defineGetter__("sandbox", function() {
                return sandbox;
            });
        }
		this.attachSIMethods(sandbox);
		this.attachWindowMethods(sandbox);
		this.dbg.enabled = true;
		this.dbg.addDebuggee(sandbox);
		this.playing = true;
		this.visualize = imns.Pref.getBoolPref("showjs");
		if (/^\/\/imacros-js:showsteps\s+(yes|no)\b/i.test(code)) this.visualize = RegExp.$1 == "yes";
		if (this.visualize) {
			iMacros.panel.showLines(code);
			this.delay = imns.Pref.getIntPref("delay");
		} else {
			this.delay = 0;
		}
		iMacros.panel.statLine3 = name;
		iMacros.panel.mboxResetError();
		iMacros.panel.updateControlPanel();
		try {
			Components.utils.evalInSandbox(code, sandbox);
		} catch (e) {
			let errtext = e.toString();
			if (!/NS_ERROR_OUT_OF_MEMORY/.test(errtext)) {
				Components.utils.reportError(e);
				errtext += ", line " + (e.lineNumber - this.startLine + 1);
				iMacros.panel.showErrorMessage(errtext, -991);
				if (iMacros.client_id) {
					this.errorMessage = errtext;
					this.errorCode = -991;
				}
			}
		} finally {
			this.dbg.clearAllBreakpoints();
			this.dbg.removeDebuggee(sandbox);
			this.dbg.enabled = false;
			this.paused = false;
			this.playing = false;
			iMacros.panel.showMacroTree();
			if (iMacros.client_id) {
				if (!this.errorMessage) {
					this.errorMessage = "OK";
					this.errorCode = 1;
				}
				var sicmd = imns.Cc["@iopus.com/sicmdlistener;1"].getService(imns.Ci.nsISupports).wrappedJSObject;
				sicmd.sendResponse(iMacros.client_id, this.errorMessage, this.errorCode, {
					extractData: "",
					lastPerformance: []
				});
				delete this.errorMessage;
				delete this.errorCode;
				delete iMacros.client_id;
			}
		}
	};
	JS_Player.prototype.stop = function() {
		this.stopIsPending = true;
	};
	JS_Player.prototype.pause = function(callback) {
		if (!this.paused) {
			this.pauseIsPending = true;
			this.pauseCallback = callback;
		}
	};
	JS_Player.prototype.unPause = function(callback) {
		if (!this.paused) {
			this.pauseIsPending = false;
			if (callback) callback();
		} else {
			this.paused = false;
			if (callback) callback();
		}
	};
	JS_Player.prototype.attachSIMethods = function(sandbox) {
		sandbox.iimPlay = function(macro_or_code) {
			var x = macro_or_code,
				name;
			if (/^code:((?:\n|.)*)$/i.test(x)) {
				var src = RegExp.$1;
				src = src.replace(/\[sp\]/gi, ' ');
				src = src.replace(/\[lf\]/gi, '\r');
				src = src.replace(/\[br\]/gi, '\n');
				x = src;
				name = "Inline code";
			} else {
				var path = imns.FIO.fixSlashes(x);
				if (!/\.iim$/i.test(path)) path += ".iim";
				x = imns.FIO.openMacroFile(path);
				if (!x || !x.exists()) {
					x = imns.FIO.openNode(path);
				}
				name = x.leafName;
			}
			iMacros.in_iimPlay = true;
			iMacros.player.play(x, 1, name);
			var ct = imns.Cc["@mozilla.org/thread-manager;1"].getService(imns.Ci.nsIThreadManager).currentThread;
			while (iMacros.player.playing) ct.processNextEvent(true);
			iMacros.in_iimPlay = false;
			iMacros.panel.showLines(iMacros.jssrc);
			return iMacros.player.errorCode;
		};
		sandbox.iimPlayCode = function(code) {
			iMacros.in_iimPlay = true;
			iMacros.player.play(code, 1, "Inline code");
			var ct = imns.Cc["@mozilla.org/thread-manager;1"].getService(imns.Ci.nsIThreadManager).currentThread;
			while (iMacros.player.playing) ct.processNextEvent(true);
			iMacros.in_iimPlay = false;
			iMacros.panel.showLines(iMacros.jssrc);
			return iMacros.player.errorCode;
		};
		sandbox.iimDisplay = function(txt) {
			iMacros.panel.showInfoMessage(txt);
			return 1;
		};
		sandbox.iimExit = function() {
			iMacros.jsplayer2.stop();
		};
		sandbox.iimClose = function() {
			sandbox.iimExit();
		};
		sandbox.iimGetLastError = function() {
			return iMacros.player.errorMessage || "OK";
		};
		sandbox.iimGetErrorText = function() {
			return sandbox.iimGetLastError();
		};
		sandbox.iimGetLastPerformance = function() {
			throw "iimGetLastPerformance not supported!";
		};
		sandbox.iimSet = function(name, val) {
			val = val.toString();
			var arr = name.match(/^(?:-var_)?(\w+)$/);
			if (arr) name = arr[1];
			arr = name.match(/^var([0-9])$/i);
			if (arr) {
				iMacros.player.vars[imns.s2i(arr[1])] = val;
			} else {
				iMacros.player.setUserVar(name, val);
			}
			return 1;
		};
		sandbox.iimGetLastExtract = function(val) {
			if (!val) return iMacros.player.getExtractData();
			var h = iMacros.player.getExtractData();
			if (!h || !h.length) return null;
			val = imns.s2i(val);
			if (isNaN(val) || h.length < val - 1) return "#nodata#";
			h = h.split("[EXTRACT]");
			return h[val - 1];
		};
		sandbox.iimGetExtract = function(val) {
			return sandbox.iimGetLastExtract();
		};
	};
	JS_Player.prototype.attachWindowMethods = function(sandbox) {
		sandbox.prompt = function(msg, def_value) {
			return typeof def_value == "undefined" ? window.content.prompt(msg) : window.content.prompt(msg, def_value);
		};
		sandbox.alert = function(msg) {
			return window.content.alert(msg);
		};
		sandbox.confirm = function(msg) {
			return window.content.confirm(msg);
		};
		sandbox.__defineGetter__("window", function() {
			return window;
		});
		sandbox.__defineGetter__("content", function() {
			return window.content;
		});
	};
	JS_Player.prototype.isPaused = function() {
		return this.paused;
	};
	return new JS_Player();
})();