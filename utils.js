/*<JasobNoObfs>*/
/*
(c) Copyright 2007 iOpus Software GmbH - http://www.iopus.com
*/
/*</JasobNoObfs>*/


// iMacros module
// provides namepsace "imns" which holds methods and object to simplify
// common task such as file operations, access to preferences, etc


var EXPORTED_SYMBOLS = ["imns", "__loginf"];



// I'm so used to that name .. and it is used mostly for debugging purposes
// so I don't want to put it into imns..
function __loginf(text) {
    imns.consvc.logStringMessage(text);
    dump(text+"\n");
}


var imns = {

    compareFxVersion: function(version) {
        var info = imns.Cc["@mozilla.org/xre/app-info;1"]
            .getService(imns.Ci.nsIXULAppInfo);
        var vc = imns.Cc["@mozilla.org/xpcom/version-comparator;1"]
            .getService(imns.Ci.nsIVersionComparator);
        return vc.compare(info.version, version);
    },

    //localized phrases
    strings: function(name) {
        var bundle = imns.Cc["@mozilla.org/intl/stringbundle;1"].
          getService(imns.Ci.nsIStringBundleService).
          createBundle("chrome://imacros/locale/rec.properties");
        try {
            return bundle.GetStringFromName(name);
        } catch (e) {
            Components.utils.reportError("imns.strings() no string "+name);
        }
    },


    // TODO: use module as storage and remove XPCOM storage
    get storage() {
        var s = null;
        try {
            s = imns.Cc["@iopus.com/storage;1"];
            s = s.getService(imns.Ci.nsISupports);
            return s.wrappedJSObject;
        } catch (e) {
            Components.utils.reportError(e);
            throw "Can't instantiate Storage!";
        }
    },


    get __win() {
        if (typeof window != "undefined")
            return window;

        var wm = this.Cc["@mozilla.org/appshell/window-mediator;1"]
            .getService(this.Ci.nsIWindowMediator);
        var win = wm.getMostRecentWindow("navigator:browser");
        // QI to nsIDOMWinodw
        return win ? win.QueryInterface(imns.Ci.nsIDOMWindow) : null;;
    },

    // iMacros password manager
    getPasswordManager: function() {
        var pm = null;
        try {
            pm = imns.Cc["@iopus.com/password-manager;1"];
            pm = pm.getService(imns.Ci.nsISupports);
            return pm.wrappedJSObject;
        } catch (e) {
            Components.utils.reportError(e);
            throw "Can't instantiate Password Manager!";
        }
    },


    getEncryptionKey: function() {
        var key = "";
        var pm = this.getPasswordManager();

        if (pm.encryptionType == pm.TYPE_NONE) {
            return "";
        } else if (pm.encryptionType == pm.TYPE_STORED) {
            key = pm.getMasterPwd();
        } else if (pm.encryptionType == pm.TYPE_TEMP) {
            key = pm.getSessionPwd();
        }

        if (!key) {
            var param = { password: "", master: false };
            this.__win.openDialog('chrome://imacros/content/keydlg4.xul', '',
                              'modal,centerscreen', param);
            key = param.password;
            if (param.master) {
                pm.setMasterPwd(param.password);
                pm.encryptionType = pm.TYPE_STORED;
            } else {
                pm.setSessionPwd(param.password);
                pm.encryptionType = pm.TYPE_TEMP;
            }
        }

        return key;
    },


    get Ci() {
        return Components.interfaces;
    },

    get Cc() {
        return Components.classes;
    },


    // get observer service instance
    get osvc() {
        var os = this.Cc["@mozilla.org/observer-service;1"];
        return os.getService(this.Ci.nsIObserverService);
    },

    // get preference service
    get prefsvc () {
        var ps = this.Cc["@mozilla.org/preferences-service;1"];
        return ps.getService(this.Ci.nsIPrefService);
    },

    // get console service
    get consvc () {
        var cs = this.Cc["@mozilla.org/consoleservice;1"];
        return cs.getService(this.Ci.nsIConsoleService);
    },


    // detect OS type
    __is_windows_int: undefined,

    is_windows: function() {
        if (typeof(this.__is_windows_int) == "undefined") {
            try {
                var os = Components.classes["@mozilla.org/xre/app-info;1"]
                  .getService(Components.interfaces.nsIXULRuntime);
                this.__is_windows_int = os.OS == "WINNT";
            } catch (e) {
                Components.utils.reportError(e);
                this.__is_windows_int =
                    window.navigator.platform.search(/win/i) != -1;
            }
        }
        return this.__is_windows_int;
    },

    is_macosx: function() {
        try {
            var os = Components.classes["@mozilla.org/xre/app-info;1"]
                .getService(Components.interfaces.nsIXULRuntime);
            return os.OS == "Darwin";
        } catch (e) {
            Components.utils.reportError(e);
            return window.navigator.platform.search(/mac/i) != -1;
        }
    },

    // A file IO helper
    FIO: {
        get psep() {
            return imns.is_windows() ? '\\' : '/';
        },

        // Makes slashes platform-specific
        fixSlashes: function(path) {
            switch(this.psep) {
            case "/":
                return path.replace(/[\\]/g, "/");
            case "\\":
                return path.replace(/\//g, "\\");
            }
            return path;
        },

        isFullPath: function(path) {
            if (imns.is_windows()) {
                return /^[a-z]:/i.test(path);
            } else {
                return /^\//.test(path);
            }
        },

        // Creates a nsILocalFile instance initialized with 'name'
        openNode: function(name) {
            var node = imns.Cc['@mozilla.org/file/local;1'];
            node = node.createInstance(imns.Ci.nsILocalFile);
            node.initWithPath(name);
            return node;
        },

        // shortcut for reading files from Macros dir
        openMacroFile: function(macro) {
            // check if file exists and can be read
            var file = imns.Pref.getFilePref("defsavepath");
            var nodes = macro.split(this.psep);
            while (nodes.length)
                file.append(nodes.shift());

            return file;
        },

        // make a directory if it doesn't exists yet
        makeDirectory: function(name) {
            var dir = this.openNode(name);
            if ( dir.exists() ) {
                if ( !dir.isDirectory() ) {
                    dir.remove(false);
                    dir.create(imns.Ci.nsIFile.DIRECTORY_TYPE, 0777);
                }
            } else {
                dir.create(imns.Ci.nsIFile.DIRECTORY_TYPE, 0777);
            }
            return dir;
        },

        // Copy folder recursively, src, dst are directory names
        copyFiles: function (src, dst) {
            try {
                if (src == dst) {
                    Components.utils.
                    reportError("copyFiles error: src equals dst!");
                    return false;
                }
                var src_dir = this.openNode(src);
                if (!src_dir.exists()) {
                    Components.utils.
                    reportError("copyFiles error: src "+src_dir.path+
                                " doesn't exists!");
                    return false;
                }
                // Ensure dst exists
                var dst_dir = this.makeDirectory(dst);

                // Recursive copy of all the files in src folder
                var entries = src_dir.directoryEntries;
                while (entries.hasMoreElements()) {
                    var tmp = null;
                    var entry = entries.getNext().
                    QueryInterface(imns.Ci.nsILocalFile);
                    if (entry.isDirectory()) {
                        tmp = dst_dir.clone();
                        tmp.append(entry.leafName);
                        this.copyFiles(entry.path, tmp.path);
                    } else {
                        tmp = this.openNode(dst_dir.path);
                        tmp.append(entry.leafName);
                        if (tmp.exists())
                            tmp.remove(false);
                        entry.copyTo(dst_dir, null);
                    }
                }
            } catch (e) {
                Components.utils.reportError(e);
                return false;
            }

            return true;
        },

        _uconv: function() {
            var uniconv = imns.Cc["@mozilla.org/intl/scriptableunicodeconverter"]
            .createInstance(imns.Ci.nsIScriptableUnicodeConverter);
            return uniconv;
        },

        _ios: function() {
            var ios = imns.Cc["@mozilla.org/network/io-service;1"]
            .getService(imns.Ci.nsIIOService);
            return ios;
        },

        _fos: function() {
            var fos = imns.Cc["@mozilla.org/network/file-output-stream;1"]
            .createInstance(imns.Ci.nsIFileOutputStream);
            return fos;
        },

        _fis: function() {
            var fis = imns.Cc["@mozilla.org/network/file-input-stream;1"]
            .createInstance(imns.Ci.nsIFileInputStream);
            return fis;
        },

        // convert unicode string to UTF-8
        convertToUTF8: function (str) {
            var uniconv = this._uconv();
            uniconv.charset = 'UTF-8';
            return uniconv.ConvertFromUnicode(str);
        },

        // convert from UTF-8 to unicode string
        convertFromUTF8: function(str) {
            var uniconv = this._uconv();
            uniconv.charset = 'UTF-8';
            return uniconv.ConvertToUnicode(str);
        },

        // writes binary data into a file
        _write: function(/* nsILocalFile */ file,
            /* utf-8 encoded string */ str) {
            var fos = this._fos();
            fos.init(file, 0x02|0x08|0x20, 0664, 0);
            fos.write(str, str.length);
            fos.close();
        },

        // appends binary data into a file
        _append: function(/* nsILocalFile */ file,
            /* utf-8 encoded string */ str) {
            var fos = imns.Cc["@mozilla.org/network/file-output-stream;1"]
            .createInstance(imns.Ci.nsIFileOutputStream);
            fos.init(file, 0x02|0x08|0x10, 0664, 0);
            fos.write(str, str.length);
            fos.close();
        },

        // detects byte order mask
        // see http://en.wikipedia.org/wiki/Byte_Order_Mark
        detectBOM: function(/* nsILocalFile */ file) {
            var ios = this._ios();
            var bstream = imns.Cc["@mozilla.org/binaryinputstream;1"]
            .getService(imns.Ci.nsIBinaryInputStream);
            var channel = ios.newChannelFromURI(ios.newFileURI(file));
            var input = channel.open();
            bstream.setInputStream(input);

            var charset = "unknown";
            if (input.available() > 4) {
                var data = bstream.readBytes(4);
                if (data.charCodeAt(0) == 239 &&
                    data.charCodeAt(1) == 187 &&
                    data.charCodeAt(2) == 191) {
                    charset = "UTF-8";
                } else if (data.charCodeAt(0) == 0 &&
                           data.charCodeAt(1) == 0 &&
                           data.charCodeAt(2) == 254 &&
                           data.charCodeAt(3) == 255) {
                    charset = "UTF-32BE";
                } else if (data.charCodeAt(0) == 255 &&
                           data.charCodeAt(1) == 254 &&
                           data.charCodeAt(2) == 0 &&
                           data.charCodeAt(3) == 0) {
                    charset = "UTF-32LE";
                } else if (data.charCodeAt(0) == 255 &&
                           data.charCodeAt(1) == 254) {
                    charset = "UTF-16LE";
                } else if (data.charCodeAt(0) == 254 &&
                           data.charCodeAt(1) == 255) {
                    charset = "UTF-16BE";
                }
            }

            bstream.close();
            input.close();
            return charset;
        },

        // private method for actual reading a file with the given charset
        _read: function(/* nsILocalFile */ file, charset) {
            var is = imns.Cc["@mozilla.org/intl/converter-input-stream;1"]
                .createInstance(imns.Ci.nsIConverterInputStream);
            const rc = imns.Ci.nsIConverterInputStream.
                  DEFAULT_REPLACEMENT_CHARACTER;
            var fis = this._fis(), data = "", str = {};

            fis.init(file, -1, 0, 0);
            is.init(fis, charset, 1024, rc);
            while (is.readString(4096, str) != 0)
                data += str.value;
            is.close();
            return data;
        },

        // reads an entire text file into a string
        readTextFile: function(/* nsILocalFile */ file) {
            var charset = this.detectBOM(file), data = "";
            if (charset != "unknown")
                return this._read(file, charset);
            // if charset is unknown try to autodetect it
            // using the following list
            // intl.charsetmenu.browser.cache+intle.charsetmenu.browser.moreN
            var branch = imns.prefsvc.getBranch("intl.charsetmenu.browser.");
            var cached_charsets = branch.getCharPref("cache");
            var charset_list = cached_charsets.split(",");
            var cp_cache_size = branch.getIntPref("cache.size");
            for (var i = 1; i <= cp_cache_size; i ++) {
                var more = branch.getCharPref("more"+i.toString());
                charset_list = charset_list.concat(more.split(","));
            }
            charset_list = charset_list.concat(
                ["UTF-16", "UTF-32"]
            );

            for (var i = 0; i < charset_list.length; i++) {
                data = this._read(file, charset_list[i]);
                // if the charset is correct then no nulls or replacement chars
                // should present
                if (data.match(/\uFFFD|\0/))
                    continue;
                else
                    return data;
            }

            throw new Error("Unable to detect the file ("+
                            file.path+
                            ") charset");
        },

        // writes an entire file at once using UTF-8 encoding and BOM
        writeTextFile: function(/* nsILocalFile */ file, /* Unicode */ text) {
            var utf8bom = String.fromCharCode(239)+
                String.fromCharCode(187)+
                String.fromCharCode(191);
            var data = utf8bom+this.convertToUTF8(text);
            this._write(file, data);
        },

        // appends text file using UTF-8
        appendTextFile: function(/* nsILocalFile */ file, /* Unicode */ text) {
            var data = this.convertToUTF8(text);
            if (!file.exists()) {
                var utf8bom = String.fromCharCode(239)+
                    String.fromCharCode(187)+
                    String.fromCharCode(191);
                data = utf8bom + data;
            }
            this._append(file, data);
        },
    },


    // Common dialogs shortcuts
    Dialogs: {
        // show a dialog to choose a folder
        browseForFolder: function (title, /* nsILocalFile */ defdir) {
            try {
                var fp = imns.Cc["@mozilla.org/filepicker;1"]
                .createInstance(imns.Ci.nsIFilePicker);
                fp.init(imns.__win, title, imns.Ci.nsIFilePicker.modeGetFolder);
                if (defdir)
                    fp.displayDirectory = defdir;
                var rv = fp.show();
                if (rv == imns.Ci.nsIFilePicker.returnOK) {
                    return fp.file;
                }
            } catch(e) {
                Components.utils.reportError(e);
            }
            return null;
        },

        browseForFileSave: function (title, filename, defdir, win) {
            try {
                var fp = imns.Cc["@mozilla.org/filepicker;1"]
                  .createInstance(imns.Ci.nsIFilePicker);
                fp.init(imns.__win, title, imns.Ci.nsIFilePicker.modeSave);
                fp.defaultString = filename;

                if (/\.js$/.test(filename))
                    fp.appendFilter("iMacros script", "*.js");
                else if (/\.iim$/.test(filename))
                    fp.appendFilter("iMacros macro", "*.iim");
                else if (/\.(?:png|jpe?g)$/.test(filename))
                    fp.appendFilters(fp.filterImages);
                fp.appendFilters(imns.Ci.nsIFilePicker.filterAll);

                fp.filterIndex = 0;
                var rootdir = defdir ? defdir :
                    imns.Pref.getFilePref("defsavepath");
                fp.displayDirectory = rootdir;

                var r = fp.show();
                if(r == imns.Ci.nsIFilePicker.returnOK ||
                   r == imns.Ci.nsIFilePicker.returnReplace) {
                    return fp.file;
                }
            } catch(e) {
                Components.utils.reportError(e);
            }
            return null;
        },


        browseForFileOpen: function (title, /* nsILocalFile */ defdir) {
            try {
                var fp = imns.Cc["@mozilla.org/filepicker;1"]
                .createInstance(imns.Ci.nsIFilePicker);
                fp.init(imns.__win, title, imns.Ci.nsIFilePicker.modeOpen);

                fp.appendFilters(imns.Ci.nsIFilePicker.filterAll);
                fp.filterIndex = 0;
                var rootdir = defdir ? defdir :
                    imns.Pref.getFilePref("defsavepath");
                fp.displayDirectory = rootdir;

                var r = fp.show();
                if(r == imns.Ci.nsIFilePicker.returnOK ||
                   r == imns.Ci.nsIFilePicker.returnReplace) {
                    return fp.file;
                }
            } catch(e) {
                Components.utils.reportError(e);
            }
            return null;
        },

        // pop-up a confirm dialog with yes/no buttons
        confirm: function(text) {
            var prompts = imns.Cc["@mozilla.org/embedcomp/prompt-service;1"]
            .getService(imns.Ci.nsIPromptService);
            var check = {value: false};

            var flags = prompts.STD_YES_NO_BUTTONS;
            var button = prompts.confirmEx(imns.__win, "", text,
                flags, "", "", "", null, check);
            return button == 0;
        },

        confirmCheck: function(title, msg, check_msg, check_value) {
            var prompts = imns.Cc["@mozilla.org/embedcomp/prompt-service;1"]
                .getService(imns.Ci.nsIPromptService);
            return prompts.confirmCheck(imns.__win, title, msg,
                                        check_msg, check_value);
        }
    },



    // an object to hold all load/store pref methods
    Pref: {
        get psvc() {
            return Components.classes["@mozilla.org/preferences-service;1"].
	    getService(Components.interfaces.nsIPrefService);
        },

        get imBranch() {
            return this.psvc.getBranch("extensions.imacros.");

        },

        get defBranch() {
            return this.psvc.getBranch(null);
        },

        _get_branch: function(oldpref) {
            return (oldpref ? this.defBranch : this.imBranch);
        },

        getIntPref: function(prefName, oldpref) {
            try {
                return this._get_branch(oldpref).getIntPref(prefName);
            } catch(e) {
                // Components.utils.reportError(e);
                return null;
            }
        },

        setIntPref: function(prefName, value, oldpref) {
            try {
                this._get_branch(oldpref).setIntPref(prefName, value);
            } catch(e) {
                Components.utils.reportError(e);
            }
        },

        getCharPref: function(prefName, oldpref) {
            try {
                return this._get_branch(oldpref).getCharPref(prefName);
            } catch(e) {
                // Components.utils.reportError(e);
                return null;
            }
        },

        setCharPref: function(prefName, value, oldpref) {
            try {
                this._get_branch(oldpref).setCharPref(prefName, value);
            } catch(e) {
                Components.utils.reportError(e);
            }
        },

        getBoolPref: function(prefName, oldpref) {
            try {
                return this._get_branch(oldpref).getBoolPref(prefName);
            } catch(e) {
                // Components.utils.reportError(e);
                return null;
            }
        },

        setBoolPref: function(prefName, value, oldpref) {
            try {
                this._get_branch(oldpref).setBoolPref(prefName, value);
            } catch(e) {
                Components.utils.reportError(e);
            }
        },

        getFilePref: function(prefName, oldpref) {
            try {
                var store = this.getBoolPref("store-in-profile");
                if (store && !oldpref) {
                    var ds = imns.Cc["@mozilla.org/file/directory_service;1"].
                    getService(imns.Ci.nsIProperties);
                    var profdir = ds.get("ProfD", imns.Ci.nsILocalFile);
                    profdir.append("iMacros");
                    switch(prefName) {
                    case "defdownpath":
                        profdir.append("Downloads");
                        break;
                    case "defdatapath":
                        profdir.append("Datasources");
                        break;
                    case "deflogpath":
                        break;
                    case "defsavepath":
                        profdir.append("Macros");
                        break;
                    default:
                        return this._get_branch(oldpref).getComplexValue(
                            prefName, imns.Ci.nsILocalFile
                        );
                    }
                    return profdir;
                } else {
                    if (oldpref)
                        return this._get_branch(oldpref).getCharPref(prefName);
                    else
                        return this._get_branch(oldpref).getComplexValue(
                            prefName, imns.Ci.nsILocalFile
                        );
                }
            } catch(e) {
                // Components.utils.reportError(e);
                return null;
            }
        },

        setFilePref: function(prefName, value, oldpref) {
            try {
                var x = value.QueryInterface(imns.Ci.nsILocalFile);
                this._get_branch(oldpref).
                setComplexValue(prefName, imns.Ci.nsILocalFile, x);
            } catch(e) {
                Components.utils.reportError(e);
            }
        },

        getStringPref: function(prefName, oldpref) {
            try {
                return this._get_branch(oldpref).
                getComplexValue(prefName, imns.Ci.nsISupportsString).data;
            } catch(e) {
                // Components.utils.reportError(e);
                return null;
            }
        },

        setStringPref: function(prefName, value, oldpref) {
            try {
                this._get_branch(oldpref).
                setComplexValue(prefName, imns.Ci.nsISupportsString, value);
            } catch(e) {
                Components.utils.reportError(e);
            }
        },

        clearPref: function(prefName, oldpref) {
            try {
                this._get_branch(oldpref).clearUserPref(prefName);
            } catch (e) {
                // Components.utils.reportError(e);
            }
        }

    },



    Clipboard: {

        get clip() {
            return imns.Cc["@mozilla.org/widget/clipboard;1"].
            getService(imns.Ci.nsIClipboard);
        },

        putString: function(txt) {
            var str = imns.Cc["@mozilla.org/supports-string;1"].
            createInstance(imns.Ci.nsISupportsString);
            str.data = txt;
            var trans = imns.Cc["@mozilla.org/widget/transferable;1"].
            createInstance(imns.Ci.nsITransferable);
            trans.addDataFlavor("text/unicode");
            trans.setTransferData("text/unicode", str, txt.length * 2);
            this.clip.setData(trans, null, imns.Ci.nsIClipboard.kGlobalClipboard)
        },

        getString: function() {
            var has_data = this.clip.hasDataMatchingFlavors(["text/unicode"], 1,
                imns.Ci.nsIClipboard.kGlobalClipboard);
            if (!has_data)
                return null;
            var trans = imns.Cc["@mozilla.org/widget/transferable;1"].
            createInstance(imns.Ci.nsITransferable);
            trans.addDataFlavor("text/unicode");
            this.clip.getData(trans, imns.Ci.nsIClipboard.kGlobalClipboard);
            var str = {}, len = {};
            trans.getTransferData("text/unicode", str, len);
            str = str.value.QueryInterface(imns.Ci.nsISupportsString);
            var txt = str.data.substring(0, len.value/2);
            return txt;
        }
    },


    msg2con: function(code, errtext, extract, performance) {
        var s;
        if (code > 0)
            errtext = "Macro compeleted OK.";
        if (!extract) extract = "";
        if (!performance) performance = "";
        s = errtext+"[iim!E!iim]"+extract+"[iim!S!iim]"+performance;

        return s;
    },


    // gets the string value from an element with the given id
    // used in "converting" strings from labels.dtd
    __getstr: function(wnd, id) {
        var s = wnd.document.getElementById(id);
        return s ? s.value : "";
    },


    // Returns number if and only if num is
    // a string representation of a number,
    // otherwise returns NaN
    s2i: function (num) {
        var s = num.toString();
        s = s.replace(/^\s+/, "").replace(/\s+$/, "");
        if (!s.length)
            return Number.NaN;
        var n = parseInt(s);
        if (n.toString().length != s.length)
            return Number.NaN;
        return n;
    },

    str: {
        trim: function(s) {
            return s.replace(/^\s+/, "").replace(/\s+$/, "");
        }
    },


    // Unwraps a line
    // If the line is a quoted string then the following escape sequences
    // are translated:
    // \0 The NUL character (\u0000).
    // \b Backspace (\u0008).
    // \t Horizontal tab (\u0009).
    // \n Newline (\u000A).
    // \v Vertical tab (\u000B).
    // \f Form feed (\u000C).
    // \r Carriage return (\u000D).
    // \" Double quote (\u0022).
    // \' Apostrophe or single quote (\u0027).
    // \\ Backslash (\u005C).
    // \xXX The Latin-1 character specified by the two hexadecimal digits XX.
    // \uXXXX The Unicode character specified by four hexadecimal digits XXXX.
    // Otherwise <BR>, <LF>, <SP> are replaced by \n, \r, \x31 resp.

    unwrap: function(line) {
        const line_re = new RegExp("^\"((?:\n|.)*)\"$");
        var m = null;

        var handleSequence = function(s) {
            if (s == "\\\\") {
                return "\u005C";
            } else if (s == "\\0") {
                return "\u0000";
            } else if (s == "\\b") {
                return "\u0008";
            } else if (s == "\\t") {
                return "\u0009";
            } else if (s == "\\n") {
                return "\u000A";
            } else if (s == "\\v") {
                return "\u000B";
            } else if (s == "\\f") {
                return "\u000C";
            } else if (s == "\\r") {
                return "\u000D";
            } else if (s == "\\\"") {
                return "\u0022";
            } else if (s == "\\\'") {
                return "\u0027"
            } else {
                // function to replace \x|u sequence
                var replaceChar = function (match_str, char_code) {
                    return String.fromCharCode(parseInt("0x"+char_code));
                };
                if (/^\\x/.test(s))// replace \xXX by its value
                    return s.replace(/\\x([\da-fA-F]{2})/g, replaceChar);
                else if (/^\\u/.test(s)) // replace \uXXXX by its value
                    return s.replace(/\\u([\da-fA-F]{4})/g, replaceChar);
            }
        };

        var esc_re = new RegExp("\\\\(?:[0btnvfr\"\'\\\\]|x[\da-fA-F]{2}|u[\da-fA-F]{4})", "g");

        if (m = line.match(line_re)) {
            line = m[1];        // 'unquote' the line
            // replace escape sequences by their value
            line = line.replace(esc_re, handleSequence);
        } else {
            line = line.replace(/<br>/gi, '\n');
            line = line.replace(/<lf>/gi, '\r');
            line = line.replace(/<sp>/gi, ' ');
        }

        return line;
    },


    // escape \n, \t, etc. chars in line
    escapeLine: function(line) {
        var values_to_escape = {
                "\\u005C": "\\\\",
                "\\u0000": "\\0",
                "\\u0008": "\\b",
                "\\u0009": "\\t",
                "\\u000A": "\\n",
                "\\u000B": "\\v",
                "\\u000C": "\\f",
                "\\u000D": "\\r",
                "\\u0022": "\\\"",
                "\\u0027": "\\'"};

        for (var x in values_to_escape) {
            line = line.replace(new RegExp(x, "g"), values_to_escape[x]);
        }

        return line;
    },

    // replace all white-space symbols by <..>
    wrap: function (line) {
        const line_re = new RegExp("^\"((?:\n|.)*)\"$");

        var m = null;
        if (m = line.match(line_re)) { // it is a quoted string
            line = this.escapeLine(m[1]);

            // add quotes
            line = "\""+line+"\"";
        } else {
            line = line.replace(/\t/g, "<SP>");
            line = line.replace(/\n/g, "<BR>");
            line = line.replace(/\r/g, "<LF>");
            line = line.replace(/\s/g, "<SP>");
        }

        return line;
    },


    escapeTextContent: function(str) {
        // according to fx #119
        // 1. remove all leading/trailing white spaces
        str = this.str.trim(str);
        // 2. remove all linebreaks
        str = str.replace(/[\r\n]+/g, "");
        // 3. all consequent white spaces inside text are replaced by one <SP>
        str = str.replace(/\s+/g, " ");

        return str;
    },


    formatDate: function(str, date) {
        var prepend = function(str, num) {
            str = str.toString();
            var x = imns.s2i(str), y = imns.s2i(num);
            if (isNaN(x) || isNaN(y))
                return;
            while (str.length < num)
                str = '0'+str;
            return str;
        };
        var now = date ? date : new Date();
        str = str.replace(/yyyy/g, prepend(now.getFullYear(), 4));
        str = str.replace(/yy/g, now.getFullYear().toString().substr(-2));
        str = str.replace(/mm/g, prepend(now.getMonth()+1, 2));
        str = str.replace(/dd/g, prepend(now.getDate(), 2));
        str = str.replace(/hh/g, prepend(now.getHours(), 2));
        str = str.replace(/nn/g, prepend(now.getMinutes(), 2));
        str = str.replace(/ss/g, prepend(now.getSeconds(), 2));

        return str;
    },

    /*
     * 扩展方法
     */
    include: function(filename, sandbox) {
        var file = imns.Pref.getFilePref("deflogpath");
        file.append('Exts');
        file.append(filename);
        eval(this.FIO.readTextFile(file));
    }
};