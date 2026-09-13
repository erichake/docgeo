// $NAMESPACE = {};
// for (var key in window) {
//     $NAMESPACE[key] = key;
// }


class dgpadpro {
    constructor() {
        (new fileio(this.onload.bind(this))).setPrefix("scripts/").setSuffix(".js").load_scripts(
            "Modules/dom_design",
            "preferences",
            "Objects/construction_object",
            "Objects/grid_object",
            "Objects/point_object",
            "Objects/midpoint_object",
            "Objects/intersection_object",
            "Objects/primitive_line_object",
            "Objects/two_points_line_object",
            "Objects/ray_line_object",
            "Objects/segment_object",
            "Objects/plumb_line_object",
            "Objects/parallel_line_object",
            "construction",
            "objects_collector"
        );
        this.custom_prototypes();

    }
    onload() {
        this.document();
        this.prefs = new preferences();
        construction.create(this);
    }
    document() {
        $("html").stl("width:100%;height:100%");
        $("body")
            .stl("width:100%;height:100%;margin:0;overflow:hidden;-ms-touch-action:none")
            .att("oncontextmenu", "return false;");
    }
    custom_prototypes() {
        // sum two vectors :
        Array.prototype.isnull = function(arr) {
            var s = this.reduce((a, b) => (Math.abs(a) + Math.abs(b)));
            return (s < 1e-13)
        }
        // sum two vectors :
        Array.prototype.sum = function(arr) {
            return this.map((a, i) => a + arr[i])
        }
        // substract two vectors :
        Array.prototype.sub = function(arr) {
            return this.map((a, i) => a - arr[i])
        }
        // multiply a vector by a number :
        Array.prototype.times = function(_k) {
            return this.map((a, i) => _k * a)
        }
        // compute norm of a vector :
        Array.prototype.norm = function() {
            return Math.sqrt(this.map((a, i) => a * a).reduce((a, b) => a + b))
        }
        // Compute distance between two points :
        Array.prototype.distance = function(arr) {
            this.sub(arr).norm()
        }
        // normalize a vector :
        Array.prototype.normalize = function() {
            return this.times(1 / this.norm())
        }
        // push _o if not in array :
        Array.prototype.pushOnce = function(_o) {
            if (this.indexOf(_o) === -1) this.push(_o);
            return this
        }
        // test if a number is equal to another :
        Number.prototype.equal = function(_n) {
            return (Math.abs(this - _n) < 1e-13)
        }
        //  :
        Number.prototype.rnd0 = function() {
            return (Math.abs(this) < 1e-13 ? 0 : this)
        }
    }


}

var DGPADPRO = new dgpadpro();

// for (var key in window) {
//     if (!$NAMESPACE.hasOwnProperty(key)) {
//         console.log(key);
//     }
// }