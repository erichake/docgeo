class fileio {
    constructor(_onload_callback) {
        this.onload_callback = _onload_callback;
        this.prefix = "";
        this.suffix = "";
    }
    setPrefix(_pre) {
        this.prefix = _pre;
        return this;
    }
    setSuffix(_su) {
        this.suffix = _su;
        return this;
    }
    load_scripts() {
        this.files_path = Array.prototype.slice.call(arguments, 0);
        var me = this;
        var loadScript = function(_num) {
            var head = document.getElementsByTagName('head')[0];
            var script = document.createElement('script');
            script.type = 'text/javascript';
            script.charset = 'utf-8';
            script.src = me.prefix + me.files_path[_num] + me.suffix;
            script.onload = function() {
                if (_num < me.files_path.length - 1) loadScript(_num + 1)
                else me.onload_callback();
            }
            head.appendChild(script);
        }
        loadScript(0);
        return this;
    }
    get_content() {
        this.files_path = Array.prototype.slice.call(arguments, 0);
        var content = "";
        var me = this;
        var res = [];
        var loadFile = function(_num) {
            var xhr = new XMLHttpRequest();
            xhr.open('POST', me.prefix + me.files_path[_num] + me.suffix, true);
            xhr.onload = function() {
                if (xhr.status === 200) {
                    res.push(xhr.responseText);
                    if (_num < me.files_path.length - 1) loadFile(_num + 1)
                    else me.onload_callback(res.join("\n\n"));
                }
            };
            xhr.send()
        }
        if (me.is_script) loadScript(0)
        else loadFile(0);
        return this;
    }
}