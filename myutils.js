var fileUtil = {
    //file read/write
    read: function(filename) {
        var file = imns.FIO.openNode(filename);
        return imns.FIO.readTextFile(file);
    },

    write: function(filename, content) {
        var file = imns.FIO.openNode(filename);
        imns.FIO.writeTextFile(file, content);
    },

    append: function(filename, content) {
        var file = imns.FIO.openNode(filename);
        imns.FIO.appendTextFile(file, content);
    },

	rmdir: function(path) {//删除文件夹里的所有文件(包括目录)
		var file = imns.FIO.openNode(path);
		if (file.isDirectory()) {
			var children = file.directoryEntries;
			while(children.hasMoreElements()) {
				var child = children.getNext().QueryInterface(Components.interfaces.nsILocalFile);
				if (child.isDirectory()) {
					this.removeFiles(child.path);
				}
				child.remove(false);
			}
		}
	},

	readdir: function(path) {//读取文件列表
		var file = imns.FIO.openNode(path);
		var list = [];
		if (file.isDirectory()) {
			var children = file.directoryEntries;
			while(children.hasMoreElements()) {
				child = children.getNext().QueryInterface(Components.interfaces.nsILocalFile);
				list.push(child.leafName);
			}
		}
		return list;
	},

	mkdir: function(path) {//创建文件夹
		imns.FIO.makeDirectory(path);
	}
};

sandbox.fileUtil = fileUtil;

//register read/write
var register = {
    write: function(key, value) {
        try {
            var storage = imns.storage;
            key = 'user_define_' + key;
            storage.setNamedObject(key, value);
            } catch(e) {
            Components.utils.reportError(e);
        }
    },

    read: function(key) {
        try {
            var storage = imns.storage;
            key = 'user_define_' + key;
            return storage.hasNamedObject(key) ? storage.getNamedObject(key) : null;
            } catch(e) {
            Components.utils.reportError(e);
        }
    },

    del: function(key) {
        try {
            var storage = imns.storage;
            key = 'user_define_' + key;
            if(storage.hasNamedObject(key)) {
                storage.clear(key);
                return true;
            } else {
                return false;
            }
            } catch(e) {
            Components.utils.reportError(e);
        }
    }
};

sandbox.register = register;

var sprintfWrapper = {
	init : function () {

		if (typeof arguments == "undefined") { return null; }
		if (arguments.length < 1) { return null; }
		if (typeof arguments[0] != "string") { return null; }
		if (typeof RegExp == "undefined") { return null; }

		var string = arguments[0];
		var exp = new RegExp(/(%([%]|(\-)?(\+|\x20)?(0)?(\d+)?(\.(\d)?)?([bcdfosxX])))/g);
		var matches = new Array();
		var strings = new Array();
		var convCount = 0;
		var stringPosStart = 0;
		var stringPosEnd = 0;
		var matchPosEnd = 0;
		var newString = '';
		var match = null;

		while (match = exp.exec(string)) {
			if (match[9]) { convCount += 1; }

			stringPosStart = matchPosEnd;
			stringPosEnd = exp.lastIndex - match[0].length;
			strings[strings.length] = string.substring(stringPosStart, stringPosEnd);

			matchPosEnd = exp.lastIndex;
			matches[matches.length] = {
				match: match[0],
				left: match[3] ? true : false,
				sign: match[4] || '',
				pad: match[5] || ' ',
				min: match[6] || 0,
				precision: match[8],
				code: match[9] || '%',
				negative: parseInt(arguments[convCount]) < 0 ? true : false,
				argument: String(arguments[convCount])
			};
		}
		strings[strings.length] = string.substring(matchPosEnd);

		if (matches.length == 0) { return string; }
		if ((arguments.length - 1) < convCount) { return null; }

		var code = null;
		var match = null;
		var i = null;

		for (i=0; i<matches.length; i++) {

			if (matches[i].code == '%') { substitution = '%' }
			else if (matches[i].code == 'b') {
				matches[i].argument = String(Math.abs(parseInt(matches[i].argument)).toString(2));
				substitution = sprintfWrapper.convert(matches[i], true);
			}
			else if (matches[i].code == 'c') {
				matches[i].argument = String(String.fromCharCode(parseInt(Math.abs(parseInt(matches[i].argument)))));
				substitution = sprintfWrapper.convert(matches[i], true);
			}
			else if (matches[i].code == 'd') {
				matches[i].argument = String(Math.abs(parseInt(matches[i].argument)));
				substitution = sprintfWrapper.convert(matches[i]);
			}
			else if (matches[i].code == 'f') {
				matches[i].argument = String(Math.abs(parseFloat(matches[i].argument)).toFixed(matches[i].precision ? matches[i].precision : 6));
				substitution = sprintfWrapper.convert(matches[i]);
			}
			else if (matches[i].code == 'o') {
				matches[i].argument = String(Math.abs(parseInt(matches[i].argument)).toString(8));
				substitution = sprintfWrapper.convert(matches[i]);
			}
			else if (matches[i].code == 's') {
				matches[i].argument = matches[i].argument.substring(0, matches[i].precision ? matches[i].precision : matches[i].argument.length)
				substitution = sprintfWrapper.convert(matches[i], true);
			}
			else if (matches[i].code == 'x') {
				matches[i].argument = String(Math.abs(parseInt(matches[i].argument)).toString(16));
				substitution = sprintfWrapper.convert(matches[i]);
			}
			else if (matches[i].code == 'X') {
				matches[i].argument = String(Math.abs(parseInt(matches[i].argument)).toString(16));
				substitution = sprintfWrapper.convert(matches[i]).toUpperCase();
			}
			else {
				substitution = matches[i].match;
			}

			newString += strings[i];
			newString += substitution;

		}
		newString += strings[i];

		return newString;

	},

	convert : function(match, nosign){
		if (nosign) {
			match.sign = '';
		} else {
			match.sign = match.negative ? '-' : match.sign;
		}
		var l = match.min - match.argument.length + 1 - match.sign.length;
		var pad = new Array(l < 0 ? 0 : l).join(match.pad);
		if (!match.left) {
			if (match.pad == "0" || nosign) {
				return match.sign + pad + match.argument;
			} else {
				return pad + match.sign + match.argument;
			}
		} else {
			if (match.pad == "0" || nosign) {
				return match.sign + match.argument + pad.replace(/0/g, ' ');
			} else {
				return match.sign + match.argument + pad;
			}
		}
	}
};

sandbox.trim = function(str) {
	return str.replace(/^\s+|\s+$/g, '');
};

sandbox.sprintf = sprintfWrapper.init;