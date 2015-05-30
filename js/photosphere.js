var gl;
var shader_program;

function init_gl(canvas)
{
	try {
		gl = canvas.getContext('experimental-webgl');
		gl.viewport_width = canvas.width;
		gl.viewport_height = canvas.height;
	}
	catch (e) {
	}
	if (!gl) {
		alert('Unable to initialize WebGL!');
	}
}

function compile_shader(gl, code, type)
{
	var shader = gl.createShader(type);

	gl.shaderSource(shader, code);
	gl.compileShader(shader);

	if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
		alert(gl.getShaderInfoLog(shader));
		return null;
	}

	return shader;
}

function init_shaders()
{
	var vertex_shader_code =
	'attribute vec2 vrt_pos;\n' +
	'\n' +
	'varying vec2 pos;\n' +
	'\n' +
	'void main(void) {\n' +
	'	pos = vrt_pos;\n' +
	'	gl_Position = vec4(vrt_pos, 0.0, 1.0);\n' +
	'}\n';

	var fragment_shader_code =
	'precision mediump float;\n' +
	'\n' +
	'uniform sampler2D tex;\n' +
	'\n' +
	'varying vec2 pos;\n' +
	'\n' +
	'void main(void) {\n' +
	'	gl_FragColor = texture2D(tex, vec2(0.5 + pos.x / 2.0, 0.5 + pos.y / 2.0));\n' +
	'}\n';

	var vertex_shader = compile_shader(gl, vertex_shader_code, gl.VERTEX_SHADER);
	var fragment_shader = compile_shader(gl, fragment_shader_code, gl.FRAGMENT_SHADER);

	var shader_program = gl.createProgram();
	gl.attachShader(shader_program, fragment_shader);
	gl.attachShader(shader_program, vertex_shader);
	gl.linkProgram(shader_program);

	if (!gl.getProgramParameter(shader_program, gl.LINK_STATUS)) {
		alert('Unable to link shaders!');
	}

	gl.useProgram(shader_program);

	shader_program.vrt_pos_attr = gl.getAttribLocation(shader_program, 'vrt_pos');
	gl.enableVertexAttribArray(shader_program.vrt_pos_attr);

	shader_program.unif_tex = gl.getUniformLocation(shader_program, 'tex');

	return shader_program;
}

var vrt_pos_buf;

function init_buffers()
{
	vrt_pos_buf = gl.createBuffer();
	gl.bindBuffer(gl.ARRAY_BUFFER, vrt_pos_buf);
	var vertices = [
		 1, -1,
		 1,  1,
		-1, -1,
		-1,  1
	];
	gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);
	vrt_pos_buf.item_size = 2;
	vrt_pos_buf.num_items = 4;
}

var texture;
function init_texture(image_src)
{
	texture = gl.createTexture();
	texture.image = new Image();
	texture.image.onload = function() {
		gl.bindTexture(gl.TEXTURE_2D, texture);
		gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
		gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, texture.image);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
		gl.bindTexture(gl.TEXTURE_2D, null);
		texture.loaded = true;
		draw_sphere();
	}

	texture.image.src = image_src;
}

function draw_sphere()
{
	gl.viewport(0, 0, gl.viewport_width, gl.viewport_height);

	if (texture.loaded) {
		gl.activeTexture(gl.TEXTURE0);
		gl.bindTexture(gl.TEXTURE_2D, texture);
		gl.uniform1i(shader_program.unif_tex, 0);
	}

	gl.bindBuffer(gl.ARRAY_BUFFER, vrt_pos_buf);
	gl.vertexAttribPointer(shader_program.vrt_pos_attr, vrt_pos_buf.item_size, gl.FLOAT, false, 0, 0);
	gl.drawArrays(gl.TRIANGLE_STRIP, 0, vrt_pos_buf.num_items);
}

function show_photosphere(canvas_id, image_src)
{
	var canvas = document.getElementById(canvas_id);
	if (!canvas) {
		alert('Unable to find canvas with ID "' + canvas_id + '"!');
		return;
	}

	canvas.width = canvas.offsetWidth;
	canvas.height = canvas.offsetHeight;

	init_gl(canvas);
	shader_program = init_shaders();
	init_buffers();
	init_texture(image_src);

	gl.clearColor(0.0, 0.0, 0.0, 1.0);

	draw_sphere();
}
