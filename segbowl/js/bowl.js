/* Collin's Bowl Designer
  (c) 2017, Collin J. Delker
  Released under the MIT License
*/

(function() {
    version = "0.1";

    function dfltclrs() {
        var clrs = [];
        for (var i=0; i<12; i++) {clrs.push("#E2CAA0");}
        return clrs;
    }
    function dfltlens(cnt=12) {
        var len = []
        for (var i=0; i<cnt; i++) {
           len.push(1);
        }
        return len;
    }

    var bowlprop = {radius: null,         // Maximum radius
                    height: null,         // Total bowl height
                    thick: .25,
                    pad: .125,
                    cpoint: null,         // Bezier control points
                    curvesegs: 50,        // # segments along each bezier curve
                    rings: [{height:.5, segs:12, clrs:dfltclrs(), seglen:dfltlens(), xvals:[], theta:0}],  // List of ring objects
                    usedrings: 1,          // Number of rings actually in the curve
                    
                    seltrapz: null,       // List of trapezoids in the selected/last-calculated ring
                    selthetas: null,      // List of theta angles starting each segment in selected ring
                    };

    var ctrl = {drag: null,     // Bezier point being dragged
                dPoint: null,   // Position of point being dragged
                selring: 1,     // Selected ring
                selseg: [],     // Selected segments
                copyring: null, // Ring being copied
                step: 1/16,     // Fraction resolution
                inch: true,     // Inches or mm
                };

    var view2d =   {canvas: null,    // 2D Canvas
                    ctx: null,       // 2D Drawing context
                    canvas2: null,   // 2D Canvas - ring view
                    ctx2: null,      // 2D Canvas - ring view context
                    canvasinches: 8, // Canvas width represents this size
                    scale: null,     // Canvas to real scale
                    bottom: null,    // Y-coord of bottom of bowl
                    centerx: null,   // X-position of center
                    };

    var view3d = {canvas: null,
                  renderer: null,
                  scene: null,
                  camera: null,
                  geom: [],
                  mesh: [],
                  };

    var style = {
        curve:  {width: 8, color: "#333"},
        cpline: {width: 1, color: "#06C"},
        point:  {radius: 5, width: 2, color: "#06C", fill: "rgba(200,200,200,0.5)"},
        segs:   {width: 1, color: "#935"},
        selring: {width: 3, color:"#FF9900"},
        selseg: {width: 3, color:"#FF0"},
        copyring: {width:3, color:"#0000FF"},
        gratio: {width:1, color:"#555555"}
        };

/*======================
 Initialize
======================*/
    function init() {
        view2d.bottom = view2d.canvas.height - 0.5 * view2d.scale;
        view2d.centerx = view2d.canvas.width/2;

        bowlprop.cpoint = [  // Bezier points in screen coords
            {x:view2d.centerx + 1.5*view2d.scale, y:view2d.bottom},
            {x:view2d.centerx + 2.0*view2d.scale, y:view2d.bottom},
            {x:view2d.centerx + 2.0*view2d.scale, y:view2d.bottom - 3.0*view2d.scale},
            {x:view2d.centerx + 2.5*view2d.scale, y:view2d.bottom - 3.5*view2d.scale},  // This point is will also be start of next bezier curve
            ];

        view2d.canvas.onmousedown = mouseClick;
        view2d.canvas.onmousemove = dragging;
        view2d.canvas.onmouseup = view2d.canvas.onmouseout = dragEnd;
        view2d.canvas.ondblclick = addRemovePoint;
        view2d.canvas2.onmousedown = segClick;
        
        document.getElementById("btnView").onclick = showMenu;
        document.getElementById("btnOptions").onclick = showMenu;
        document.getElementById("btnBowl").onclick = showMenu;
        document.getElementById("btnRing").onclick = showMenu;
        document.getElementById("btnSeg").onclick = showMenu;
        document.getElementById("btnCopy").onclick = ringCopy;
        document.getElementById("btnPaste").onclick = ringPaste;
        document.getElementById("zoomIn").onclick = zoom;
        document.getElementById("zoomOut").onclick = zoom;
        document.getElementById("inptThick").oninput = thickChange;
        document.getElementById("inptPad").oninput = padChange;
        document.getElementById("showsegs").onchange = drawCanvas;
        document.getElementById("showsegnum").onchange = drawCanvas;
        document.getElementById("showratio").onchange = drawCanvas;
        document.getElementById("segHup").onclick = setSegHeight;
        document.getElementById("segHdn").onclick = setSegHeight;
        document.getElementById("segNup").onclick = setSegCnt;
        document.getElementById("segNdn").onclick = setSegCnt;
        document.getElementById("segLup").onclick = setSegL;
        document.getElementById("segLdn").onclick = setSegL;
        document.getElementById("segLreset").onclick = setSegL;
        document.getElementById("ringrot").onchange = rotateRing;
        document.getElementById("btnTwist").onclick = twist;
        document.getElementById("viewRing").onclick = setView;
        document.getElementById("view3D").onclick = setView;
        document.getElementById("viewProf").onclick = setView;
        document.getElementById("inch").onclick = unitChange;
        document.getElementById("mm").onclick = unitChange;
        document.getElementById("gentable").onclick = genReport;
        document.getElementById("about").onclick = about;
        window.addEventListener('resize', resizeWindow);
        var btnclrclass = document.getElementsByClassName("clrbtn");
        for (var i=0; i<btnclrclass.length; i++) {
            btnclrclass[i].onclick = colorChange;
        }
        
        document.getElementById("btnPal").onclick = showPalette;
        
        drawCanvas();

        // Now init the 3D view
        view3d.canvas = document.getElementById("canvas3d");
        view3d.canvas.width = view2d.ctx.canvas.width;
        view3d.canvas.height = view2d.ctx.canvas.height;

        view3d.renderer = new THREE.WebGLRenderer({canvas:view3d.canvas, antialias:true});
        view3d.renderer.setClearColor("lightblue");

        view3d.scene = new THREE.Scene();
        view3d.camera = new THREE.PerspectiveCamera(45, 1, 1, 100);
        view3d.camera.position.set(0,view2d.canvasinches,view2d.canvasinches+3);
        var camlight = new THREE.PointLight(0xAAAAAA);
        camlight.position.set(20,30,20);
        view3d.camera.add(camlight);

        var controls  = new THREE.OrbitControls(view3d.camera, view3d.renderer.domElement);
        controls.target.set(0,4,0);
        controls.update();
        controls.addEventListener("change", render3D);
        view3d.scene.add(view3d.camera);
        var light = new THREE.AmbientLight(0xffffff, .6);
        view3d.scene.add(light);
        /* var axisHelper = new THREE.AxisHelper(5);
        view3d.scene.add(axisHelper);  */
        build3D();
    }

/*======================
  Calculate bowl stuff
======================*/
    function calcRings() {
        var ppp = calcBezPath();
        var paths = offsetCurve(calcBezPath(), bowlprop.thick/2);

        // Split path into components
        var pathx1 = [], pathx2 = [], pathy1 = [], pathy2 = [];
        for (var i=0; i<paths.c1.length; i++) {
            pathx1.push(paths.c1[i].x);
            pathx2.push(paths.c2[i].x);
            pathy1.push(paths.c1[i].y);
            pathy2.push(paths.c2[i].y);
        }

        // Vertical profile
        bowlprop.height = Math.max(Math.max.apply(null, pathy1), Math.max.apply(null, pathy2));
        bowlprop.radius = Math.max(Math.max.apply(null, pathx1), Math.max.apply(null, pathx2));
        var y = -bowlprop.thick/2;
        var i = 0;
        while (y < bowlprop.height) {
            var x = [];    // x-values within this ring
            var yidx = []; // INDEX of y-values in this ring
            if (bowlprop.rings.length <= i) {  // Need a new ring
                bowlprop.rings.push({height: .75, segs:12, clrs:dfltclrs(), seglen:dfltlens(), xvals:[], theta:0});
            }
            for (var p=0; p<pathx1.length; p++) {
                if (pathy1[p] > y && pathy1[p] < y+bowlprop.rings[i].height) {x.push(pathx1[p]); yidx.push(p);}
                if (pathy2[p] > y && pathy2[p] < y+bowlprop.rings[i].height) {x.push(pathx2[p]); yidx.push(p);}
                if (p>1 && pathy1[p-1] < y && pathy1[p] > y+bowlprop.rings[i].height) {
                    // ring is too thin, curve points jump over it.. interpolate.
                    var m = (pathy1[p] - pathy1[p-1]) / (pathx1[p] - pathx1[p-1]);
                    x.push((y-pathy1[p-1])/m + pathx1[p-1]);
                    yidx.push(p);
                }
                if (p>1 && pathy2[p-1] < y && pathy2[p] > y+bowlprop.rings[i].height) {
                    var m = (pathy2[p] - pathy2[p-1]) / (pathx2[p] - pathx2[p-1]);
                    x.push((y-pathy2[p-1])/m + pathx2[p-1]);
                    yidx.push(p);
                }
            }
            bowlprop.rings[i].xvals = {max: Math.max(0, Math.max.apply(null, x)+bowlprop.pad),
                                       min: Math.max(0, Math.min.apply(null, x)-bowlprop.pad)};
            y += bowlprop.rings[i].height;
            i += 1;
        }
        bowlprop.usedrings = i;
    }

    function calcRingTrapz(ringidx, rotate=true) {
        if (ringidx == null) {ringidx = 0}
        var rotation = 0;
        var trapzlist = [];
        var thetas = [];
        var maxtheta = [];
         for (var segidx=0; segidx<bowlprop.rings[ringidx].seglen.length; segidx++) {
            maxtheta.push(Math.PI / bowlprop.rings[ringidx].segs * bowlprop.rings[ringidx].seglen[segidx]);
        }
        maxtheta = Math.max.apply(null, maxtheta);
        var theta;
        for (var segidx=0; segidx<bowlprop.rings[ringidx].seglen.length; segidx++) {
            thetas.push(rotation);
            theta = Math.PI / bowlprop.rings[ringidx].segs * bowlprop.rings[ringidx].seglen[segidx];
            x2 = bowlprop.rings[ringidx].xvals.max * Math.cos(theta)/Math.cos(maxtheta);  // cosines make different width segments meet at endpoints
            x1 = (bowlprop.rings[ringidx].xvals.min) * Math.cos(theta);
            y2 = x2 * Math.tan(theta);
            y1 = (bowlprop.rings[ringidx].xvals.min) * Math.sin(theta);
            var trapz = [{x:x1, y:y1}, {x:x2,y:y2}, {x:x2,y:-y2}, {x:x1,y:-y1}];
            if (rotate) {
                var rtrapz = [];
                var toffset = bowlprop.rings[ringidx].theta; // + rotation;
                for (var p=0; p<trapz.length; p++) {
                    // Complex-number magic to rotate segment around
                    zx = Math.cos(theta + rotation + toffset);  // exp(j*theta*i) with j=complex
                    zy = Math.sin(theta + rotation + toffset);

                    rx = trapz[p].x*zx - trapz[p].y*zy;  // Basically complex number multiplication
                    ry = trapz[p].y*zx + trapz[p].x*zy;
                    rtrapz.push({x:rx, y:ry});
                }
                trapz = rtrapz;
            }
            rotation += theta*2;
            trapzlist.push(trapz);
        }
        bowlprop.seltrapz = trapzlist;
        bowlprop.selthetas = thetas;
    }

    function calcBezPath(real=true) {   // real or screen coords?
        if (real) {
            var rpoint = screenToReal();
        } else {
            var rpoint = bowlprop.cpoint;
        }

        var points = [new THREE.Vector2(0,0), new THREE.Vector2(.1, 0)];
        for (var j=0; j<rpoint.length-1; j+=3) {    // Step through each bezier
            for (var t=0; t<=1; t+=1/bowlprop.curvesegs) {    // Each t-value
                mt = Math.max(0, 1-t);
                points.push(new THREE.Vector2(
                    mt*mt*mt*(rpoint[j].x) + 3*t*mt*mt*(rpoint[j+1].x) + 3*t*t*mt*(rpoint[j+2].x) + t*t*t*(rpoint[j+3].x),
                    mt*mt*mt*(rpoint[j].y) + 3*t*mt*mt*(rpoint[j+1].y) + 3*t*t*mt*(rpoint[j+2].y) + t*t*t*(rpoint[j+3].y)));		
            }
        }
        points.push(rpoint[rpoint.length-1]); // Always end with last point (in case t != 1 exactly)
        return points;
    }

    function offsetCurve(curve, offset) {
        // Numerical approximation by shifting line segments
        // Returns two curves, one with + offset one with - offset
        // And closes the gap with perp. line
        var newcurve = [];
        var newcurve2 = [];
        for (var i = 0; i < curve.length-1; i++) {
            dx = curve[i+1].x - curve[i].x;
            dy = curve[i+1].y - curve[i].y;
            dd = Math.sqrt(dx*dx+dy*dy);
            kx = -dy/dd
            ky = dx/dd;
            newcurve.push(new THREE.Vector2(curve[i].x + offset * kx, curve[i].y + offset * ky));
            newcurve2.push(new THREE.Vector2(curve[i].x - offset * kx, curve[i].y - offset * ky));
        }
        // Get the last point
        newcurve.push(new THREE.Vector2(curve[curve.length-1].x + offset * kx, curve[curve.length-1].y + offset * ky));
        newcurve2.push(new THREE.Vector2(curve[curve.length-1].x - offset * kx, curve[curve.length-1].y - offset * ky));
        newcurve2.push(newcurve[newcurve.length-1])   // Close the gap
        return {c1:newcurve, c2:newcurve2};   // c1 is inner wall, c2 outer wall
    }

    function screenToReal() {  // Entire path
        npoint = [];
        for (var p in bowlprop.cpoint) {
        npoint.push(new THREE.Vector2(
                (bowlprop.cpoint[p].x - view2d.canvas.width/2) / view2d.scale,
                (view2d.canvas.height - bowlprop.cpoint[p].y) / view2d.scale - .5)); // .5 to put at 0,0
        }
        return npoint;
    }

    function screenToRealPoint(x,y) {   // Single point
        return {x: (x - view2d.canvas.width/2) / view2d.scale,
                y: (view2d.canvas.height - y) / view2d.scale - .5}
    }

    function realToScreen(x,y, ofst=-.5) {
        return {x: x * view2d.scale + view2d.canvas.width/2, 
                y: -(y-ofst) * view2d.scale + view2d.canvas.height};
    }

    function splitRingY(curve) {  // Split the curve into separate curves for each ring, interpolating to get correct endpoints
        y = 0;
        curveparts = [];
        for (var i=0; i<bowlprop.rings.length; i++) {
            segcurve = [];
            if (i==0) {segcurve.push({x:curve[0].x, y:curve[0].y})}  // Always get first point
            for (var p=1; p<curve.length; p++) {
                if (curve[p-1].y < y && curve[p].y > y+bowlprop.rings[i].height) {  // Make sure we don't skip over thin rings
                    var m = (curve[p].y - curve[p-1].y) / (curve[p].x - curve[p-1].x);
                    segcurve.push({x: (y - curve[p-1].y) / m + curve[p-1].x, y:y});
                    segcurve.push({x: (y+bowlprop.rings[i].height - curve[p-1].y) / m + curve[p-1].x, y:y+bowlprop.rings[i].height});
                } else if (curve[p-1].y <= y && curve[p].y > y) {  // First point inside segment y
                    var m = (curve[p].y - curve[p-1].y) / (curve[p].x - curve[p-1].x);
                    segcurve.push({x: (y - curve[p].y) / m + curve[p].x, y:y});
                } else if (curve[p-1].y < y + bowlprop.rings[i].height && curve[p].y >= y + bowlprop.rings[i].height) {  // Last point in segment y
                    var m = (curve[p].y - curve[p-1].y) / (curve[p].x - curve[p-1].x);
                    segcurve.push({x: (y+bowlprop.rings[i].height - curve[p].y) / m + curve[p].x, y:y+bowlprop.rings[i].height});
                } else if (curve[p].y >= y && curve[p].y < y + bowlprop.rings[i].height) {
                    segcurve.push({x:curve[p].x, y:curve[p].y});
                }  // else, p is not in segment y
            }
            if (i==bowlprop.rings.length-1) {segcurve.push(curve[curve.length-1])}
            if (segcurve.length > 1) {
                curveparts.push(segcurve);
            }
            y += bowlprop.rings[i].height;
        }
        return curveparts;
    }

/*======================
  Drawing functions
======================*/
    function clearCanvas(canvas, ctx) {
        var grd=ctx.createLinearGradient(0, view2d.canvas.height,0,0);
        grd.addColorStop(0,"lightblue");
        grd.addColorStop(1,"lightgray");
        ctx.fillStyle=grd;
        ctx.fillRect(0,0, canvas.width, canvas.height);	
    }

    function drawSegProfile(ctx) {
        calcRings();
        y = -bowlprop.thick/2;
        for (var i=0; i<bowlprop.rings.length; i++) {
            ctx.beginPath();
            if (i == ctrl.copyring) {
                ctx.strokeStyle = style.copyring.color;
                ctx.lineWidth = style.copyring.width;
            }
            else if (i == ctrl.selring) { 
                ctx.strokeStyle = style.selring.color;
                ctx.lineWidth = style.selring.width;
            } else { 
                ctx.strokeStyle = style.segs.color;
                ctx.lineWidth = style.segs.width;
            }
            if (y<=bowlprop.height) {
                p1 = realToScreen(bowlprop.rings[i].xvals.min, y);
                p2 = realToScreen(bowlprop.rings[i].xvals.max, y+bowlprop.rings[i].height);
                ctx.rect(p1.x, p1.y, p2.x-p1.x, p2.y-p1.y);
                ctx.stroke();
                if (document.getElementById("showsegnum").checked) {
                    ctx.fillStyle = "black";
                    ctx.font = "15px Arial";
                    ctx.textAlign = "center";
                    ctx.fillText(i.toString(), p2.x+10, (p1.y+p2.y)/2 + 3);
                    ctx.stroke();
                }
            }
            y += bowlprop.rings[i].height;
        }
    }

    function drawControlLines(ctx) {  // Straight lines connecting control points
        ctx.lineWidth = style.cpline.width;
        ctx.strokeStyle = style.cpline.color;
        ctx.beginPath();
        ctx.moveTo(bowlprop.cpoint[0].x, bowlprop.cpoint[0].y);
        for (var i=0; i<bowlprop.cpoint.length-1; i+=3) {
            ctx.lineTo(bowlprop.cpoint[i+1].x, bowlprop.cpoint[i+1].y);
            ctx.moveTo(bowlprop.cpoint[i+2].x, bowlprop.cpoint[i+2].y);
            ctx.lineTo(bowlprop.cpoint[i+3].x, bowlprop.cpoint[i+3].y);
        }
        ctx.stroke();
    }

    function drawControlPoints(ctx) {
        for (var i=0; i<bowlprop.cpoint.length; i++) {
            ctx.lineWidth = style.point.width;
            ctx.strokeStyle = style.point.color;
            ctx.fillStyle = style.point.fill;
            ctx.beginPath();
            ctx.arc(bowlprop.cpoint[i].x, bowlprop.cpoint[i].y, style.point.radius, 0, 2*Math.PI);
            ctx.fill();
            ctx.stroke();
        }
    }

    function drawPoly(ctx, poly, fill=true) {
        ctx.beginPath();
        var point;
        for (var p=0; p<poly.length; p++) {
            point = realToScreen(poly[p].x, poly[p].y, ofst=0);
            if (p==0) {
                ctx.moveTo(point.x, point.y - ctx.canvas.height/2);
            } else {
                ctx.lineTo(point.x, point.y - ctx.canvas.height/2);
            }
        }
        ctx.closePath();
        if (fill) {ctx.fill();}
        ctx.stroke();
    }

    function drawRing(ctx, selring) {
        calcRingTrapz(selring, rotate=true);
        for (var i=0; i<bowlprop.rings[selring].segs; i++) {
            ctx.strokeStyle = "#000";
            ctx.lineWidth = 2;
            ctx.fillStyle = bowlprop.rings[selring].clrs[i];
            drawPoly(ctx, bowlprop.seltrapz[i], fill=true);
        }
        for (var i=0; i<ctrl.selseg.length; i++) {
            ctx.strokeStyle = style.selseg.color;
            ctx.lineWidth = style.selseg.width;
            drawPoly(ctx, bowlprop.seltrapz[ctrl.selseg[i]], fill=false);
        }
        ctx.lineWidth = 1;
        ctx.strokeStyle = "#000";
        ctx.beginPath();
        ctx.arc(ctx.canvas.width/2, ctx.canvas.height/2, (bowlprop.rings[selring].xvals.min+bowlprop.pad)*view2d.scale, 0, Math.PI*2);
        ctx.arc(ctx.canvas.width/2, ctx.canvas.height/2, (bowlprop.rings[selring].xvals.max-bowlprop.pad)*view2d.scale, 0, Math.PI*2);
        ctx.stroke();
    }

    function drawCurve(ctx) { // Draw the bezier curve(s)
        ctx.lineWidth = bowlprop.thick*view2d.scale;
        ctx.strokeStyle = style.curve.color;
        ctx.beginPath();
        ctx.moveTo(view2d.centerx, view2d.bottom);
        ctx.lineTo(bowlprop.cpoint[0].x, bowlprop.cpoint[0].y);
        for (var i=0; i<bowlprop.cpoint.length-1; i+=3) {
            ctx.bezierCurveTo(
                bowlprop.cpoint[i+1].x, bowlprop.cpoint[i+1].y, 
                bowlprop.cpoint[i+2].x, bowlprop.cpoint[i+2].y,
                bowlprop.cpoint[i+3].x, bowlprop.cpoint[i+3].y);
        }
        
        // Left-side mirror curve
        ctx.moveTo(view2d.centerx, view2d.bottom);
        ctx.lineTo(view2d.canvas.width-bowlprop.cpoint[0].x, bowlprop.cpoint[0].y);
        for (var i=0; i<bowlprop.cpoint.length-1; i+=3) {
            ctx.bezierCurveTo(
                canvas.width-bowlprop.cpoint[i+1].x, bowlprop.cpoint[i+1].y, 
                canvas.width-bowlprop.cpoint[i+2].x, bowlprop.cpoint[i+2].y,
                canvas.width-bowlprop.cpoint[i+3].x, bowlprop.cpoint[i+3].y);
        }
        ctx.stroke();
    }
    
    function drawGRatio(ctx) {
            ctx.lineWidth = style.gratio.width;
            ctx.strokeStyle = style.gratio.color;
            var topleft = realToScreen(-bowlprop.radius, bowlprop.height);
            var botright = realToScreen(bowlprop.radius, 0);
            var g = (botright.y - topleft.y) / 1.618;
            var g2 = (botright.x - topleft.x) / 1.618;
            ctx.beginPath();
            ctx.rect(topleft.x, topleft.y, 2*bowlprop.radius*view2d.scale, bowlprop.height*view2d.scale);
            ctx.stroke();
            ctx.setLineDash([5]);
            ctx.moveTo(topleft.x, topleft.y+g);
            ctx.lineTo(botright.x, topleft.y+g);
            ctx.moveTo(topleft.x, botright.y-g);
            ctx.lineTo(botright.x, botright.y-g);
            ctx.moveTo(topleft.x+g2, topleft.y);
            ctx.lineTo(topleft.x+g2, botright.y);
            ctx.moveTo(botright.x-g2, topleft.y);
            ctx.lineTo(botright.x-g2, botright.y);
            ctx.stroke();
            ctx.setLineDash([]);
    }

    function drawCanvas() {
        clearCanvas(view2d.canvas, view2d.ctx);
        clearCanvas(view2d.canvas2, view2d.ctx2);
        if (document.getElementById("showsegs").checked) {
            drawSegProfile(view2d.ctx);
        }
        if (document.getElementById("showratio").checked) {
            drawGRatio(view2d.ctx);
        }
        drawControlLines(view2d.ctx);
        drawCurve(view2d.ctx);
        drawControlPoints(view2d.ctx);
        if (document.getElementById("canvas2").style.display != "none" && ctrl.selring != null) {
            drawRing(view2d.ctx2, ctrl.selring);
        }
        updateRingInfo();
    }

    function build3D() {
        if (document.getElementById("canvas3d").style.display == 'none') {return}  // Don't calculate if not shown
        curve = calcBezPath();
        calcRings();
        var offcurve = offsetCurve(curve, bowlprop.thick/2);
        for (var m=0; m<view3d.mesh.length; m++) {
            view3d.mesh[m].geometry.dispose();
            view3d.mesh[m].material.dispose()
            view3d.scene.remove(view3d.mesh[m]);
        }
        view3d.mesh = [];
        
        curvesegs = splitRingY(offcurve.c2);    // Outer wall
        for (var i=0; i<curvesegs.length; i++) {
            if (curvesegs[i].length > 1) {
                var tottheta = bowlprop.rings[i].theta;
                for (var seg=0; seg<bowlprop.rings[i].segs; seg++) {
                    theta = (2 * Math.PI / bowlprop.rings[i].segs ) * bowlprop.rings[i].seglen[seg];
                    var material = new THREE.MeshPhongMaterial({color: bowlprop.rings[i].clrs[seg]});
                    material.side = THREE.DoubleSide;
                    view3d.mesh.push(new THREE.Mesh(
                        new THREE.LatheGeometry(
                              curvesegs[i], 10, tottheta, theta), material));
                    tottheta += theta;
                    view3d.scene.add(view3d.mesh[view3d.mesh.length-1]);
                }
            }
        }
        curvesegs = splitRingY(offcurve.c1);    // Inner wall
        for (var i=0; i<curvesegs.length; i++) {
            if (curvesegs[i].length > 1) {
                tottheta = bowlprop.rings[i].theta;
                for (var seg=0; seg<bowlprop.rings[i].segs; seg++) {
                    theta = (2 * Math.PI / bowlprop.rings[i].segs) * bowlprop.rings[i].seglen[seg];
                    var material = new THREE.MeshPhongMaterial({color: bowlprop.rings[i].clrs[seg]});
                    material.side = THREE.DoubleSide;
                    view3d.mesh.push(new THREE.Mesh(
                        new THREE.LatheGeometry(
                              curvesegs[i], 10, tottheta, theta), material));
                    tottheta += theta;
                    view3d.scene.add(view3d.mesh[view3d.mesh.length-1]);
                }
            }
        }
        render3D();
    }

    function render3D() {
        view3d.renderer.render(view3d.scene, view3d.camera);
    }

/*======================
 Event handlers
======================*/
    function showMenu() {
        var s = {btnOptions: "mnuOptions",
                 btnView: "mnuView",
                 btnBowl: "mnuBowl",
                 btnRing: "mnuRing",
                 btnSeg: "mnuSeg"}[this.id]
        var e = document.getElementById(s);
        if (e.style.display == "none") {e.style.display = "inline"}
        else {e.style.display = "none"}
    }

    function range(start, stop, step=1) {
        var A = [];
        for (var i=start; i<=stop; i+=step) {A.push(i);}
        return A;
    }

    function segClick(e) {
        e = mousePos(e, view2d.canvas2);
        var dx, dy, r, theta, seg;
        dx = (e.x - view2d.centerx) / view2d.scale;
        dy =  (e.y - view2d.centerx) / view2d.scale;  // Always a square
        r = Math.sqrt((dx*dx)+(dy*dy));
        if (r >= bowlprop.rings[ctrl.selring].xvals.min-bowlprop.pad && r<bowlprop.rings[ctrl.selring].xvals.max+bowlprop.pad) {
            var inc = document.getElementById("segselect").value;
            if (inc == "all") {
                ctrl.selseg = range(0, bowlprop.rings[ctrl.selring].segs-1);
            } else {
                theta = (Math.atan2(-dy,dx) + 2*Math.PI) % (2*Math.PI);
                for (var s=1; s<bowlprop.selthetas.length; s++) {
                    if (theta <= bowlprop.selthetas[s]) {seg = s-1; break;}
                    seg = bowlprop.selthetas.length-1;
                }
                if (inc == "single") {
                    ctrl.selseg = [seg];
                } else {
                    ctrl.selseg = range(seg%parseInt(inc), bowlprop.rings[ctrl.selring].segs-1, parseInt(inc));
                }
            }
        } else {
            ctrl.selseg = [];
        }
        drawCanvas();
    }

    function mouseClick(e) {
        e = mousePos(e, view2d.canvas);
        var dx, dy;
        // Check if near a control point
        for (var i=0; i<bowlprop.cpoint.length; i++) {
            dx = bowlprop.cpoint[i].x - e.x;
            dy = bowlprop.cpoint[i].y - e.y;
            if ((dx*dx) + (dy*dy) < style.point.radius*style.point.radius) {
                ctrl.drag = i;
                ctrl.dPoint = e;
                view2d.canvas.style.cursor = "move";
                return;
            }
        }
        // Not near ctrl point, check if in a segment
        e = screenToRealPoint(e.x, e.y);
        var y = -bowlprop.thick/2;
        for (var i=0; i<bowlprop.rings.length; i++) {
            if (e.x > bowlprop.rings[i].xvals.min && e.x < bowlprop.rings[i].xvals.max
                && e.y > y && e.y < y+bowlprop.rings[i].height) {
                    ctrl.selring = i;
                    ctrl.selseg = [];
                    drawCanvas();
                    setRingHtxt();
                    setSegCntTxt();
                    document.getElementById("ringrot").value = bowlprop.rings[i].theta * 180 / Math.PI;
                    return;
                }
            y += bowlprop.rings[i].height
        }
        ctrl.selring = null;   // Not near anything
        drawCanvas();
    }

    function dragging(e) {
        if (ctrl.drag !== null) {
            e = mousePos(e, view2d.canvas);
            bowlprop.cpoint[ctrl.drag].x += e.x - ctrl.dPoint.x;
            bowlprop.cpoint[ctrl.drag].y += e.y - ctrl.dPoint.y;
            ctrl.dPoint = e;
            drawCanvas();
            if (document.getElementById("redrawdrag").checked) {
                build3D();
            }
        }
    }

    function dragEnd() {
        ctrl.drag = null;
        view2d.canvas.style.cursor = "default";
        drawCanvas();
        build3D();
    }

    function addRemovePoint(e) {
        // If position (e) close to existing control point, remove it
        // otherwise if close to line, add a new control point
        e = mousePos(e, view2d.canvas);
        for (var i=0; i<bowlprop.cpoint.length; i+=3) {  // Go by 3 to get cpoints ON line
            dx = bowlprop.cpoint[i].x - e.x;
            dy = bowlprop.cpoint[i].y - e.y;
            if ((dx*dx) + (dy*dy) < style.point.radius*style.point.radius) {
                if (i==0 || i==bowlprop.cpoint.length-1) { return };  // Don't remove first or last point
                bowlprop.cpoint.splice(i-1, 3);  // Remove point and associated ctrl pts
                drawCanvas();
                return;
            }
        }

        var dmin = 1000, imin;
        var path = calcBezPath(false);
        for (var i=1; i<path.length; i++) {
            dx = path[i].x - e.x;
            dy = path[i].y - e.y;
            if (dmin > dx*dx+dy*dy) { // Find closest point to the curve
                dmin = dx*dx+dy*dy;
                imin = i;
            }
        }
        if (dmin < style.point.radius*style.point.radius) {
            // If we're close enough, insert a point and 2 tangential control points
            t = imin / path.length - path.length / bowlprop.curvesegs;
            idx = 2 + 3 * Math.floor(imin / bowlprop.curvesegs);
            bowlprop.cpoint.splice(idx, 0, path[imin+2]);
            bowlprop.cpoint.splice(idx, 0, path[imin]);
            bowlprop.cpoint.splice(idx, 0, path[imin-2]);
            drawCanvas();
        }
    }

    function reduce(value, step=null) {   // Convert value into a fraction with step resolution
        if (ctrl.inch == false) {
            return (value*25.4).toFixed(1).concat(' mm');
        } else if (isNaN(step) || step == "decimal") {
            return value.toFixed(1).concat('"');
        }
        if (step == null) {step = ctrl.step}

        if (value == 0) {return '0"'}
        numerator = Math.round(value / step);
        denominator = 1/step;
        if (numerator == denominator) {return '1"'};
        var gcd = function gcd(a,b){
            return b ? gcd(b, a%b) : a;
        }
        gcd = gcd(numerator,denominator);
        if (gcd == denominator) {return (numerator/denominator).toString().concat('"') }  // Whole number
        if (numerator > denominator) {  //Mixed fraction
            var whole = Math.floor(numerator/denominator);
            numerator = numerator%denominator;
            return whole.toString().concat(' ').concat(numerator/gcd).toString().concat('&frasl;').concat((denominator/gcd).toString().concat('"'));
            }
        return (numerator/gcd).toString().concat('&frasl;').concat((denominator/gcd).toString().concat('"'));
    }

    function mousePos(event, canvas) {
        event = (event ? event : window.event);
        return {
            x: event.pageX - canvas.offsetLeft,
            y: event.pageY - canvas.offsetTop
        };
    }

    function thickChange() {
        slider = document.getElementById("inptThick");
        bowlprop.thick = Number(slider.value);
        document.getElementById("valThick").innerHTML = reduce(slider.value);
        drawCanvas();
        build3D();
    }

    function padChange() {
        slider = document.getElementById("inptPad");
        bowlprop.pad = Number(slider.value);
        document.getElementById("valPad").innerHTML = reduce(slider.value);	
        drawCanvas();
        build3D();
    }

    function setSegHeight() {
        if (ctrl.selring != null) {
            if (this.id == "segHup") {
                bowlprop.rings[ctrl.selring].height += ctrl.step;
            } else if (bowlprop.rings[ctrl.selring].height - ctrl.step > 0) {
                bowlprop.rings[ctrl.selring].height -= ctrl.step;
            }
            setRingHtxt();
            drawCanvas();
            build3D();
        }
    }

    function setSegCnt() {
        if (this.id == "segNup") {
            bowlprop.rings[ctrl.selring].segs += 1;
            if (bowlprop.rings[ctrl.selring].clrs.length < bowlprop.rings[ctrl.selring].segs) {
                bowlprop.rings[ctrl.selring].clrs.push(bowlprop.rings[ctrl.selring].clrs[bowlprop.rings[ctrl.selring].clrs.length - 1]);
            }
            bowlprop.rings[ctrl.selring].seglen = dfltlens(bowlprop.rings[ctrl.selring].segs);  // just reset this
        } else if (bowlprop.rings[ctrl.selring].segs > 3) {
            bowlprop.rings[ctrl.selring].segs -= 1;
            bowlprop.rings[ctrl.selring].seglen = dfltlens(bowlprop.rings[ctrl.selring].segs);  // just reset this
        }
        ctrl.selseg = [];
        setSegCntTxt();
        drawCanvas();
        build3D();
    }

    function setSegL() {
        if (this.id == "segLreset") {
            bowlprop.rings[ctrl.selring].seglen = dfltlens(bowlprop.rings[ctrl.selring].segs);
        } else if (ctrl.selseg.length != bowlprop.rings[ctrl.selring].segs) {
            var inc = .05;  // 5%
            if (this.id == "segLdn") {inc = -inc;}
            var dec = inc * ctrl.selseg.length / (bowlprop.rings[ctrl.selring].segs - ctrl.selseg.length);
            for (var i=0; i<ctrl.selseg.length; i++) {
                // Selected rings go up by inc
                bowlprop.rings[ctrl.selring].seglen[ctrl.selseg[i]] += inc;
            }
            for (var i=0; i<bowlprop.rings[ctrl.selring].segs; i++) {
                if (ctrl.selseg.indexOf(i) == -1) {
                    bowlprop.rings[ctrl.selring].seglen[i] -= dec;
                }
            }
        }
        drawCanvas();
        build3D();
    }

    function rotateRing() {
        if (ctrl.selring != null) {
            bowlprop.rings[ctrl.selring].theta = Math.PI / 180 * this.value;
            drawCanvas();
            build3D();
        }
    }

    function twist() {
        var step = Math.PI / 180 * parseFloat(prompt("Enter total rotation", "30")) / bowlprop.usedrings;
        for (var i=0; i<bowlprop.usedrings; i++) {
            bowlprop.rings[i].theta = i * step;
        }
        document.getElementById("ringrot").value = bowlprop.rings[ctrl.selring].theta * 180 / Math.PI;        
        drawCanvas();
        build3D();
    }

    function ringCopy() {
        ctrl.copyring = ctrl.selring;
        drawCanvas();
    }

    function ringPaste() {
        if (ctrl.selring && ctrl.copyring) {  // Make a deep copy
            bowlprop.rings[ctrl.selring] = {
                height: bowlprop.rings[ctrl.copyring].height,
                segs: bowlprop.rings[ctrl.copyring].segs,
                clrs: [],
                xvals: [],
                seglen: [],
                theta: bowlprop.rings[ctrl.copyring].theta,
                }
            for (var c in bowlprop.rings[ctrl.copyring].clrs) {bowlprop.rings[ctrl.selring].clrs.push(bowlprop.rings[ctrl.copyring].clrs[c])}
            for (var c in bowlprop.rings[ctrl.copyring].seglen) {bowlprop.rings[ctrl.selring].seglen.push(bowlprop.rings[ctrl.copyring].seglen[c])}
            ctrl.copyring = null;
            drawCanvas();
            build3D();
        }
    }

    function colorChange() {
        var clr = this.style.backgroundColor;
        for (var i=0; i<ctrl.selseg.length; i++) {
            bowlprop.rings[ctrl.selring].clrs[ctrl.selseg[i]] = clr;
        }
        drawCanvas();
        build3D();
    }

    function setSegCntTxt() {
        document.getElementById("segNtxt").innerHTML = "Segments: ".concat(bowlprop.rings[ctrl.selring].segs);
    }

    function setRingHtxt() {
        document.getElementById("segHtxt").innerHTML = reduce(bowlprop.rings[ctrl.selring].height);
    }

    function setView() {
        if (this.id == "viewProf") {
            var canv = document.getElementById("canvas");
            var ctrls = document.getElementById("segHctrl")
        }
        else if (this.id == "viewRing") {
            var canv = document.getElementById("canvas2");
            var ctrls = document.getElementById("segNctrl")
        } else {
            var canv = document.getElementById("canvas3d");
            var ctrls = '';
        }

        if (this.checked) {
            canv.style.display = "inline"
            if (ctrls != null && ctrls != '') {ctrls.style.visibility = "visible";}
        } else {
            canv.style.display = "none"
            if (ctrls != null && ctrls != '') {ctrls.style.visibility = "hidden";}
        }
        resizeWindow();
    }

    function unitChange() {
        var thick = document.getElementById("inptThick");
        var pad = document.getElementById("inptPad");
        if (document.getElementById("inch").checked) {
            ctrl.inch = true;
            ctrl.step = 1/16;
            bowlprop.thick = roundTo(bowlprop.thick, 16);
            bowlprop.pad = roundTo(bowlprop.pad, 16);
            for (var p in bowlprop.rings) {
                bowlprop.rings[p].height = roundTo(bowlprop.rings[p].height, 16);
            }
            thick.setAttribute("step", 1/16);
            thick.value = bowlprop.thick;
            pad.setAttribute("step", 1/16);
            pad.value = bowlprop.pad;
            document.getElementById("rptprec").style.visibility="visible";
            document.getElementById("zoomTxt").innerHTML = 'View: ' + (view2d.canvasinches).toFixed(0).concat('"');
        } else {
            ctrl.inch = false;
            ctrl.step = 0.5/25.4;
            bowlprop.thick = roundTo(bowlprop.thick*25.4, 2)/25.4;
            bowlprop.pad = roundTo(bowlprop.pad*25.4, 2)/25.4;
            for (var p in bowlprop.rings) {
                bowlprop.rings[p].height = roundTo(bowlprop.rings[p].height*25.4, 2)/25.4;
            }
            thick.setAttribute("step", 0.5/25.4);
            thick.setAttribute("value", bowlprop.thick);
            pad.setAttribute("step", 0.5/25.4);
            pad.setAttribute("value", bowlprop.pad);
            document.getElementById("rptprec").style.visibility="hidden";
            document.getElementById("zoomTxt").innerHTML = 'View: ' + (view2d.canvasinches*2.54).toFixed(0).concat(' cm');			
        }
        thickChange();
        padChange();
        setRingHtxt();
        drawCanvas();
    }

    function zoom() {
        if (ctrl.inch) {
            var inc = 1;
            var mult = 1;
            var unit = '"';
        } else {
            var inc = 10/25.4;  // 1cm?
            var mult = 2.54;
            var unit = ' cm';
        }
        if (this.id == "zoomIn") {inc = -inc}
        if (this.id == "zoomIn" && view2d.canvasinches <= 2) {return}
        var oldcp = screenToReal()

        view2d.canvasinches += inc;
        view2d.scale = view2d.ctx.canvas.width / view2d.canvasinches;
          view2d.bottom = view2d.canvas.height - 0.5 * view2d.scale;
          view2d.centerx = view2d.canvas.width/2;
        document.getElementById("zoomTxt").innerHTML = 'View: ' + (view2d.canvasinches*mult).toFixed(0).concat(unit);

        for (var p in oldcp) {
            bowlprop.cpoint[p] = realToScreen(oldcp[p].x, oldcp[p].y);
        }
        drawCanvas();
    }

    function roundTo(value, denom) {
        return Math.round(value*denom)/denom
    }

    function resizeWindow() {
        var oldcp = screenToReal()
        var cnt = 0
        if (document.getElementById("canvas").style.display != "none") {cnt++}
        if (document.getElementById("canvas2").style.display != "none") {cnt++}
        if (document.getElementById("canvas3d").style.display != "none") {cnt++}
        if (cnt > 0) {
            if (cnt > 1) {
                view2d.ctx.canvas.width = (window.innerWidth - document.getElementById("left").clientWidth)/cnt - 15;
            } else {
                view2d.ctx.canvas.width = Math.min(document.getElementById("left").clientHeight, window.innerWidth - document.getElementById("left").clientWidth-15);
            }
            view2d.ctx.canvas.height = view2d.ctx.canvas.width;
            view2d.ctx2.canvas.width = view2d.ctx.canvas.width;
            view2d.ctx2.canvas.height = view2d.ctx2.canvas.width;
            view2d.scale = view2d.ctx.canvas.width / view2d.canvasinches;
            view2d.bottom = view2d.canvas.height - 0.5 * view2d.scale;
            view2d.centerx = view2d.canvas.width/2;

            view3d.renderer.setSize(view2d.ctx.canvas.width, view2d.ctx.canvas.height);
            view3d.camera.updateProjectionMatrix();
            for (var p in oldcp) {
                bowlprop.cpoint[p] = realToScreen(oldcp[p].x, oldcp[p].y);
            }
            drawCanvas();
            build3D();
        }
    }

    function getReportSegsList(ring) {
        var donesegs = [];
        var seginfo = []
        calcRingTrapz(ring, rotate=false);
        for (var seg=0; seg<bowlprop.rings[ring].segs; seg++) {
            idx = donesegs.indexOf(bowlprop.rings[ring].seglen[seg]);
            if (idx == -1) {
                seginfo.push({theta: 180 / bowlprop.rings[ring].segs * bowlprop.rings[ring].seglen[seg],
                              outlen: 2 * bowlprop.seltrapz[seg][1].y,
                              inlen:  2 * bowlprop.seltrapz[seg][0].y,
                              width:  bowlprop.seltrapz[seg][1].x - bowlprop.seltrapz[seg][0].x,
                              length: 2 * bowlprop.seltrapz[seg][1].y,
                              cnt: 1});
                donesegs.push(bowlprop.rings[ring].seglen[seg]);
            } else {
                seginfo[idx].length += seginfo[idx].outlen;
                seginfo[idx].cnt ++;
            }
        }
        return seginfo;
    }

    function updateRingInfo() {   // Ring info on main page
        if (document.getElementById("canvas2").style.display != "none" && ctrl.selring != null) {
            step = 1 / parseInt(document.getElementById("rptfmt").value);
            var txt = ["Ring:", ctrl.selring.toString(), "<br>",
                       "Diameter:", reduce(bowlprop.rings[ctrl.selring].xvals.max * 2, step), "<br>",
                       "Thickness:", reduce(bowlprop.rings[ctrl.selring].height, step), '<br><hr align="left" width="20%">'];
            seglist = getReportSegsList(ctrl.selring);
            for (var seg=0; seg<seglist.length; seg++) {
                txt = txt.concat([
                                  "Segments:", seglist[seg].cnt, "<br>",
                                  "&nbsp;Angle:", seglist[seg].theta.toFixed(2).concat("&deg;"), "<br>",
                                  "&nbsp;Outside Length:", reduce(seglist[seg].outlen, step), "<br>",
                                  "&nbsp;Inside Length:", reduce(seglist[seg].inlen, step), "<br>",
                                  "&nbsp;Width:", reduce(seglist[seg].width, step), "<br>",
                                  "&nbsp;Strip Length:", reduce(seglist[seg].length, step), "<br>",
                                  '<hr align="left" width="20%">']);
            }
            document.getElementById("report").innerHTML = txt.join(" ");
        } else {
            document.getElementById("report").innerHTML = "";
        }
    }
    
    function genReport() {  // Full HTML report
        step = 1 / parseInt(document.getElementById("rptfmt").value);
        var nwindow = window.open('', 'Report', 'height=800,width=1000');
        nwindow.document.write('<html><head><title>Bowl Report</title>');
        nwindow.document.write('<link rel="stylesheet" href="style.css">');
        nwindow.document.write('</head>');
        nwindow.document.write('<button onclick="window.print();">Print</button>');
        nwindow.document.write('<button onclick="window.close();">Close</button>');
        nwindow.document.write('<h3>Ring list</h3>');
        nwindow.document.write('<table><tr><th>Ring</th><th>Diameter</th><th>Thickness</th><th>Rotation</th><th>Segments</th><th>Cut Angle</th><th>Outside<br>Length</th><th>Inside<br>Length</th><th>Strip<br>Width</th><th>Total<br>Strip Length<sup>*</sup></th></tr>');
        var txt = ['<tr><th>Base</th><td>', reduce(bowlprop.rings[0].xvals.max*2, step), '</td><td>', reduce(bowlprop.rings[0].height, step), '</td><td>-</td>',
                   '<td>-</td>','<td>-</td>','<td>-</td>','<td>-</td>','<td>-</td>','<td>-</td>','</tr>'];
        nwindow.document.write(txt.join(''));

        for (var i=1; i<bowlprop.usedrings; i++) {
            seglist = getReportSegsList(i);
            txt = ['<tr><th rowspan="' + seglist.length + '">', i, '</th>',
                   '<td>', reduce(bowlprop.rings[i].xvals.max*2, step), '</td>',
                   '<td>', reduce(bowlprop.rings[i].height, step), '</td>',
                   '<td>', (180 / Math.PI * bowlprop.rings[i].theta).toFixed(2).concat("&deg;"), '</td>'
                   ]
            for (var seg=0; seg<seglist.length; seg++) {

                if (seg > 0) {txt = txt.concat(['<tr><td></td><td></td><td></td>'])}
                 txt = txt.concat([
                 '<td>', seglist[seg].cnt, '</td>',
                 '<td>', seglist[seg].theta.toFixed(2).concat("&deg;"), '</td>',
                 '<td>', reduce(seglist[seg].outlen, step), '</td>',
                 '<td>', reduce(seglist[seg].inlen, step), '</td>',
                 '<td>', reduce(seglist[seg].width, step), '</td>',
                 '<td>', reduce(seglist[seg].length, step), '</td>',
                 '</tr>' 
                   ]);
            }
            console.log(txt.join(''));
            nwindow.document.write(txt.join(''))
        }
        nwindow.document.write('</table>')
        nwindow.document.write('<sup>*</sup> Excluding saw kerf');
        nwindow.document.write('<h3>Bowl Profile</h3>');

        ctrl.selring = null,
        ctrl.selseg = [];
        bcanvas = document.getElementById("backcanvas");
        ctx = bcanvas.getContext("2d")
        ctx.canvas.width = view2d.canvas.width;
        ctx.canvas.height = view2d.canvas.height;
        clearCanvas(bcanvas, ctx);
        drawCurve(ctx);
        drawSegProfile(ctx);
        nwindow.document.write('<p><img src="'+bcanvas.toDataURL("image/png")+'"/>');
        view3d.renderer.render(view3d.scene, view3d.camera);
        nwindow.document.write('<img src="'+view3d.renderer.domElement.toDataURL("image/png")+'"/>');
        
        for (var i=0; i<bowlprop.usedrings; i++) {
            clearCanvas(bcanvas, ctx);
            drawRing(ctx, i);
            nwindow.document.write('<h3>Ring ' + i + '</h3>');
            nwindow.document.write('<p><img src="'+bcanvas.toDataURL("image/png")+'"/>');
        }
        nwindow.document.write('</body></html>');
        nwindow.document.close();
    }

    function showPalette() {
        var woodcolors = [
            '#FDFAF4', '#E2CAA0', '#C29A1F', '#C98753', '#AC572F', '#995018', '#7B4F34',
            '#6E442E', '#623329', '#51240D', '#EFEBE0', '#EFB973', '#AD743F', '#965938',
            '#884B2F', '#7C3826', '#843E4B', '#582824', '#44252B', '#342022'];
        var brightcolors = [
            "#FF0000", "#FF8000", "#FFFF00", "#80FF00", "#00FF80", "#00FFFF", "#0080FF",
            "#0000FF", "#FF00FF", "#800040", "#FF6666", "#FFCC66", "#FFFF66", "#CCFF66",
            "#66FF66", "#66FFCC", "#66CCFF", "#6666FF", "#CC66FF", "#000000"];

        document.getElementById("colortype").onchange =
        function() {
            if (this.value == "wood") {
                clist = woodcolors;
            } else {
                clist = brightcolors;
            }
            var buttons = document.getElementsByClassName("clrsel");
            for (var i in clist) {
                buttons[i].style.backgroundColor = clist[i];
            }
        }
    
        function dragclr(ev) {
            ev.dataTransfer.setData("text", ev.target.style.backgroundColor);
        }

        function dragover(ev) {
            ev.preventDefault();
        }

        function dropclr(ev) {
            ev.preventDefault();
            var clr = ev.dataTransfer.getData("text");
            ev.target.style.backgroundColor = clr;
        }

        document.getElementById("colorselect").innerHTML = "";
        var div;
        var clropts = document.createElement("p");
        for (var i in woodcolors) {
            if (i == woodcolors.length/2) {clropts.appendChild(document.createElement("br"));}
            c = document.createElement("span");
            c.className = "clrsel";
            c.style.backgroundColor = woodcolors[i];
            c.draggable = "true";
            c.ondragstart = dragclr;
            clropts.appendChild(c);
        }

        var btnpalette = document.getElementsByClassName("clrbtn");
        var palette = document.createElement("p");
        palette.appendChild(document.createElement("hr"));
        palette.appendChild(document.createTextNode("Palette: "));
        for (var i=0; i<btnpalette.length; i++) {
            c = document.createElement("span");
            c.className = "tmppal";
            c.style.backgroundColor = btnpalette[i].style.backgroundColor;
            c.ondragover = dragover;
            c.ondrop = dropclr;
            palette.appendChild(c);
        }
        document.getElementById("colorselect").appendChild(clropts);
        document.getElementById("colorselect").appendChild(palette);
        document.getElementById("palettewindow").style.display = "block";
    }

    document.getElementsByClassName("close")[0].onclick = function() {
        var btnpalette = document.getElementsByClassName("clrbtn");
        var tmppalette = document.getElementsByClassName("tmppal");
        for (var i=0; i<btnpalette.length; i++) {
            btnpalette[i].style.backgroundColor = tmppalette[i].style.backgroundColor;
        }
        document.getElementById("palettewindow").style.display = "none";
    }

    function about() {
        var user = "developer"
        var domain = "collindelker.com"
        document.getElementById("contact").innerHTML = user + '@' + domain;
        document.getElementById("version").innerHTML = 'Version ' + version;
        document.getElementById("aboutwindow").style.display = "block";
        document.getElementsByClassName("close")[1].onclick = function() {
            document.getElementById("aboutwindow").style.display = "none";
        }
    }


    // Main
    view2d.canvas = document.getElementById("canvas");
    view2d.ctx = view2d.canvas.getContext("2d");
    view2d.canvas2 = document.getElementById("canvas2");
    view2d.ctx2 = view2d.canvas2.getContext("2d");
    
    view2d.ctx.canvas.width = (window.innerWidth - document.getElementById("left").clientWidth)/3 - 15;
    view2d.ctx.canvas.height = view2d.ctx.canvas.width;
    view2d.ctx2.canvas.width = (window.innerWidth - document.getElementById("left").clientWidth)/3 - 15;
    view2d.ctx2.canvas.height = view2d.ctx2.canvas.width;
    view2d.scale = view2d.ctx.canvas.width / view2d.canvasinches;
    init();
})();