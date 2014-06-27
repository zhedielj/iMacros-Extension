Instatll
================
replace files: utils.js, jsplayer.js

Sample
================

1. Now can use `iMacros` object
    var file = imns.FIO.openMacroFile('test.js');
    iMacros.playJSFile(file);

2. import library (these library located at `Exts` sub folder of iMacros working folder)

    imns.include('myutils.js', sandbox);

    //call funtions defined in myutils.js
    register.write('test', 'a value');
    alert(register.read('test'));
    register.del('test');
    alert(register.read('test'));

    alert(trim(' aabbb '));

    //jquery plugin
    imns.include('jquery.js', sandbox);
    alert($('body').html());