const regl = require('regl')()
const width = 1080
const height = 720

const seed = (Array(width * height * 4).fill().map(() => {
  return (Math.random() * 255)
}))

const [sharpBuffer, blurBuffer] = (Array(2).fill().map(() => {
  return regl.framebuffer({
    color: regl.texture({
      width,
      height,
      data: seed,
      mag: 'linear',
      min: 'linear'
    }),
    depthStencil: false
  })
}))

const neighborhood = [
 [-1.0, -1.0], [0.0, -1.0], [1.0, -1.0],
 [-1.0, 0.0],  [0.0, 0.0],  [1.0, 0.0],
 [-1.0, 1.0],  [0.0, 1.0],  [1.0, 1.0],
]

const blurKernal = [
  1.0, 2.0, 1.0,
  2.0, 4.0, 2.0,
  1.0, 2.0, 1.0
]

const sharpKernal = [
   0.0,  -1.0,   0.0,
  -1.0,   5.0,  -1.0,
   0.0,  -1.0,   0.0
]

const sharpFrag = `
precision mediump float;
precision mediump int;

uniform sampler2D blurTex;
uniform vec2 resolution;
uniform vec2 neighborhood[9];
uniform mat3 kernal, neighborhoodX, neighborhoodY;
varying vec2 uv;

void main() {
  vec4 sum = vec4(0.0);
  for( int x = 0; x < 3; x++ ) {
    for( int y = 0; y < 3; y++ ) {
      vec4 n = texture2D(
        blurTex,
        uv.xy + (vec2(neighborhoodX[x][y], neighborhoodY[x][y]) / resolution.xy)
        ); 

      sum += n * kernal[x][y];
    }
  }

  gl_FragColor = vec4(clamp(sum.rgb, 0.0, 1.0), 1.0);
}
`

const blurFrag = `
precision mediump float;
precision mediump int;

uniform sampler2D sharpTex;
uniform vec2 resolution;
uniform mat3 kernal, neighborhoodX, neighborhoodY;
varying vec2 uv;

void main() {
  vec2 st = uv;
  st -= vec2(0.5); //center origin
  st *= mat2(0.99, 0.0, 0.0, 0.99); //zoom
  st += vec2(0.5); //move origin back

  vec4 sum = vec4(0.0);
  for( int x = 0; x < 3; x++ ) {
    for( int y = 0; y < 3; y++ ) {
      vec4 n = texture2D(
        sharpTex,
        st.xy + (vec2(neighborhoodX[x][y], neighborhoodY[x][y]) / resolution.xy)
        );

      sum += n * kernal[x][y];
    }
  }

  sum /= 16.0;

  gl_FragColor = vec4(clamp(sum.rgb, 0.0, 1.0), 1.0);
}
`

const calculateBlur = regl({
  frag: blurFrag,
  uniforms: {
    resolution: () => [width, height],
    kernal: blurKernal,
    neighborhoodX: neighborhood.map(i => i[0]),
    neighborhoodY: neighborhood.map(i => i[1]),
    sharpTex: sharpBuffer 
  },
  framebuffer: blurBuffer
})

const calculateSharp = regl({
  frag: sharpFrag,
  uniforms: {
    resolution: () => [width, height],
    kernal: sharpKernal,
    neighborhoodX: neighborhood.map(i => i[0]),
    neighborhoodY: neighborhood.map(i => i[1]),
    blurTex: blurBuffer,
  },
  framebuffer: sharpBuffer 
})

const draw = regl({
  vert: `
  precision mediump float;
  attribute vec2 position;
  uniform vec2 resolution;
  varying vec2 uv;
  void main() {
    uv = 0.5 * (position + 1.0);
    gl_Position = vec4(position, 0.0, 1.0);
  }
  `,
  frag: `
  precision mediump float;
  uniform sampler2D feedback;
  varying vec2 uv;

  void main() {
    vec4 s = texture2D(feedback, uv);
    gl_FragColor = vec4(s.rgb, 1.0);
  }
  `,
  attributes: {
    position: [-4, -4, 4, -4, 0, 4]
  },
  uniforms: {
    resolution: () => [width, height],
    feedback: sharpBuffer,
  },
  depth: { enable: false },
  count: 3
})

regl.frame(() => {
  draw(() => {
    calculateSharp()
    calculateBlur()
    regl.draw()
  })
}) 
