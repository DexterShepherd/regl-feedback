const regl = require('regl')()
const width = 1024
const height = 768

const seed = (Array(width * height * 4).fill().map(() => {
  return (Math.random() * 255)
}))

const fbos = (Array(2).fill().map(() => {
  return regl.framebuffer({
    color: regl.texture({
      width, height,
      data: seed,
      wrap: 'clamp'
    }),
    depthStencil: false
  })
}))

const neighborhood = [
 [-1, -1], [0, -1], [1, -1],
 [-1, 0],  [0, 0],  [1, 3],
 [-1, 1],  [0, 1],  [1, 1],
]

const blurWeights = [
  1.0, 2.0, 1.0,
  2.0, 4.0, 2.0,
  1.0, 2.0, 1.0
]

const sharpWeights = [
   0.0,  -0.5,   0.0,
  -0.5,   3.0,  -0.5,
   0.0,  -0.5,   0.0
]

const sharpFrag = `
precision mediump float;
precision mediump int;

uniform sampler2D blurTex;
uniform vec2 resolution;
uniform mat3 weights, neighborhoodX, neighborhoodY;
varying vec2 uv;

vec4 sum = vec4(0.0);
void main() {
  vec4 sum = vec4(0.0);
  for( int x = 0; x < 3; x++ ) {
    for( int y = 0; y < 3; y++ ) {
      vec4 n = texture2D(
        blurTex,
        uv + vec2(
          neighborhoodX[x][y] / resolution.x,
          neighborhoodY[x][y] / resolution.y
        )); 

      sum += n * weights[x][y];
    }
  }

  gl_FragColor = vec4(sum.rgb, 1.0);
}
`

const blurFrag = `
precision mediump float;
precision mediump int;

uniform sampler2D sharpTex;
uniform vec2 resolution;
uniform mat3 weights, neighborhoodX, neighborhoodY;
varying vec2 uv;

vec4 sum = vec4(0.0);
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
        st + vec2(
          neighborhoodX[x][y] / resolution.x,
          neighborhoodY[x][y] / resolution.y
        )); 

      sum += n * weights[x][y];
    }
  }

  sum /= 16.0;

  gl_FragColor = vec4(sum.rgb, 1.0);
}
`

const frags = [ blurFrag, sharpFrag ]
const weights = [ blurWeights, sharpWeights ]


const calculateBlur = regl({
  frag: blurFrag,
  uniforms: {
    resolution: () => [width, height],
    weights: blurWeights,
    neighborhoodX: neighborhood.map(i => i[0]),
    neighborhoodY: neighborhood.map(i => i[1]),
    sharpTex: fbos[1] 
  },
  framebuffer: fbos[0] 
})

const calculateSharp = regl({
  frag: sharpFrag,
  uniforms: {
    resolution: () => [width, height],
    weights: sharpWeights,
    neighborhoodX: neighborhood.map(i => i[0]),
    neighborhoodY: neighborhood.map(i => i[1]),
    blurTex: fbos[0],
  },
  framebuffer: fbos[1] 
})

const draw = regl({
  vert: `
  precision mediump float;
  attribute vec2 position;
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
    feedback: fbos[0],
  },
  depth: { enable: false },
  count: 3
})

regl.frame(() => {
  draw(() => {
    calculateBlur()
    calculateSharp()
    regl.draw()
  })
}) 
