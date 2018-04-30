const COLOR = {
  r: 255,
  g: 0,
  b: 119
}
const _COLOR = {
  r: 1,
  g: 163,
  b: 245
}
const DEFAULT_PARAMS = {
  // number of particles
  count: 30,
  //life time of each particle in milliseconds
  life: 5000,
  // radius range of particle
  radius_min: 1,
  radius_max: 2.5,
  //color fo particles
  color_particle: `rgba(${COLOR.r}, ${COLOR.g}, ${COLOR.b}, 0.3)`,
  color_line: `rgba(${COLOR.r}, ${COLOR.g}, ${COLOR.b}, 0.15)`,
  // speed and steer
  speed: 0.2,
  maxDeltaAngleDegree: 1,
  // proximity range
  connection_range: 45,
  connection_max_per_particle: 2,
  connection_width: 1,
  // repel radius
  repel_radius: 40,
  repel_force: 0.012,
  // isReflected
  isReflected: true,
  // mass behaviour
  isMass: true,
  isAlignWithNeighbors: true,
}

//#region global functions
function RandomRangeFloat(min, max) {
  return Math.random() * (max - min) + min
}

function RandomPoint(width, height, offsetW = 0, offsetH = 0) {
  return {
    x: RandomRangeFloat(offsetW, width - offsetW),
    y: RandomRangeFloat(offsetH, height - offsetH)
  }
}

function IsInArea(x, y, width, height) {
  if (x > 0 && x < width && y > 0 && y < height) return true; else return false;
}

function Clamp (value, min, max) {
  if (value <= min ) return min;
  else if (value >= max) return max;
  else return value
}

function SignedAngleRadian(ax, ay, bx, by) {
  var a1 = Math.atan2(ay, ax);
  var b1 = Math.atan2(by, bx);
  var r = b1 - a1;
  if (r < -Math.PI ) r += Math.PI
  if (r > Math.PI) r -= Math.PI
  return r
}

function RotateVector2(x, y, r){
  var cosA = Math.cos(r)
  var sinA = Math.sin(r)
  return {
    x: cosA * x - sinA * y,
    y: sinA * x + cosA * y
  }
}
//#endregion
// -------------------------------------------------------------------------------------------------------------

//#region Particle class
//--------------------------------------------------------------------------------------------------------------
var Particle = function(index) {
  this.index = index
}

Particle.prototype.init = function (width, height, offsetRatio, radius_min, radius_max, color, speed, life) {
  offsetRatio += 2
  var w = width / offsetRatio
  var h = height / offsetRatio
  var p = RandomPoint(width, height, w, h)
  var r = RandomRangeFloat(radius_min, radius_max)
  this.x = p.x
  this.y = p.y
  this.radius = r
  this.color = color
  var random_angle = RandomRangeFloat(0, Math.PI * 2)
  this.velocity = {
    x: Math.cos(random_angle) * speed,
    y: Math.sin(random_angle) * speed
  }
  this.time_birth = new Date().getTime() + RandomRangeFloat(0, life)
  return this
}

Particle.prototype.isDead = function (now, life) {
  var d = now - this.time_birth
  return d > life
}

Particle.prototype.update = function (angle, speedRatio = 1) {
  if (angle) {
    var v = RotateVector2(this.velocity.x, -this.velocity.y, angle)
    this.velocity.x = v.x
    this.velocity.y = -v.y
  }
  this.x += this.velocity.x * speedRatio
  this.y += this.velocity.y * speedRatio
}

Particle.prototype._update = function (tx, ty, speedRatio = 1) {
  var dx = tx - this.velocity.x
  var dy = ty - this.velocity.y
  dx *= 0.001
  dy *= 0.001
  this.velocity.x += dx
  this.velocity.y += dy
  this.x += this.velocity.x * speedRatio
  this.y += this.velocity.y * speedRatio
}

Particle.prototype.drawParticle = function (ctx) {
  ctx.beginPath()
  ctx.arc(this.x, this.y, this.radius, 0, 2 * Math.PI)
  ctx.fill()
  ctx.closePath()
}

// 在实例粒子和参数粒子之间划线，如果满足两个粒子的距离小于range的话
Particle.prototype.drawConnections = function (ctx, particle) {
  ctx.moveTo(this.x, this.y)
  ctx.lineTo(particle.x, particle.y)
}
//#endregion
// ---------------------------------------------------------------------------------------------------------------------------------------------------------

//#region pJS - internal Particle System
// ------------------------------------------------------------------------------------------------------------------------------------
var pJS = function (context, width, height, params) {
  this.context = context
  this.width = width
  this.height = height
  this.params = params
  this.particles = []
}

pJS.prototype.init = function () {
  this.params.maxDeltaAngleDegree = Clamp(this.params.maxDeltaAngleDegree, 0, 90)
  this._maxDeltaAngleRadian = (this.params.maxDeltaAngleDegree / 180) * Math.PI
  var w = this.width
  var h = this.height
  this._whInvSq = 1 / (w * w + h * h)
  this._radius_repel_sq = this.params.repel_radius * this.params.repel_radius
  this.particles = []
  this.connected = []
  for (var i = 0; i < this.params.count; i++) {
    var p = new Particle(i)
    p.init(this.width,this.height,0.01,this.params.radius_min, this.params.radius_max, this.params.color_particle, this.params.speed, this.params.life)
    this.particles.push(p)
    var c = []
    for (var j = 0; j < this.params.count; j++) c.push(false)
    this.connected.push(c)
  }
}

pJS.prototype._clearConnect = function () {
  for (var i = 0; i < this.params.count; i++) {
    for (var j = 0; j < this.params.count; j++) {
      this.connected[i][j] = false
    }
  }
}

pJS.prototype._recordConnect = function (i, j) {
  this.connected[i][j] = true
  this.connected[j][i] = true
}

pJS.prototype._isConnected = function (i, j) {
  return this.connected[i][j] || this.connected[j][i]
}

pJS.prototype._reflectParticle = function (p) {
  if (p.y < 0) {
    p.y = - p.y
    p.velocity.y = - p.velocity.y
  }
  if (p.y > this.height) {
    p.y = this.height - (p.y - this.height)
    p.velocity.y = - p.velocity.y
  }
  if (p.x < 0) {
    p.x = - p.x
    p.velocity.x = - p.velocity.x
  }
  if (p.x > this.width) {
    p.x = this.width - (p.x - this.width)
    p.velocity.x = - p.velocity.x
  }
}

pJS.prototype._update = function () {

  // prepare drawing 
  var t = this.particles.length
  var rangeSqr = this.params.connection_range * this.params.connection_range
  this.context.setFillStyle(this.params.color_particle)
  this.context.setStrokeStyle(this.params.color_line)
  this.context.setLineWidth(this.params.connection_width)
  this._clearConnect() // clear the connect table

  // 如果有群体行为的话，先求出质心
  if (this.params.isMass) {
    var x = 0,y = 0
    for (var i = 0; i < t; i++) {
      x += this.particles[i].x
      y += this.particles[i].y
    }
    var massCenterX
    var massCenterY
    // massCenterX = x / t
    // massCenterY = y / t
    massCenterX = (this.width) / 2
    massCenterY = (this.height) / 2
  }
  
  for (var i = 0; i < t; i++) {
    var p = this.particles[i]

    // and update particle position
    // draw all the connections of this particle
    this.context.beginPath()
    var count = 0, neighborCount = 0
    var neighborX = 0, neighborY = 0
    for (var j = 0; j < t; j++) {
      if (j === i) continue
      var q = this.particles[j]
      var dx = p.x - q.x
      var dy = p.y - q.y
      var rq = dx * dx + dy * dy
      var d = this._radius_repel_sq / (rq + this._radius_repel_sq) - 0.5
      if (d > 0) {
        d *= this.params.repel_force
        dx *= d
        dy *= d
        p.x += dx
        p.y += dy
        q.x -= dx
        q.y -= dy
      }
      if (rq < rangeSqr) {
        neighborX += q.velocity.x
        neighborY += q.velocity.y
        neighborCount++
        if (count <= this.params.connection_max_per_particle && !this._isConnected(i, j)) {
          p.drawConnections(this.context, q, rangeSqr)
          this._recordConnect(i, j)
          count++
        }
      }
    }

    neighborX /= neighborCount
    neighborY /= neighborCount

    // update the pos of particle
     var targetVelocityX
     var targetVelocityY
    if (this.params.isMass) {
      var lookToVelocityX, lookToVelocityY, targetVelocityX, targetVelocityY
      if (this._touchPos) {
        lookToVelocityX = this._touchPos.x - p.x
        lookToVelocityY = this._touchPos.y - p.y
        targetVelocityX = (lookToVelocityX * 0.1 + neighborX * 0.9) 
        targetVelocityY = (lookToVelocityY * 0.1 + neighborY * 0.9) 
      } else {
        lookToVelocityX = massCenterX - p.x
        lookToVelocityY = massCenterY - p.y
        targetVelocityX = (lookToVelocityX * 0.1 + neighborX * 0.9)
        targetVelocityY = (lookToVelocityY * 0.1 + neighborY * 0.9)
      }
      var dq = targetVelocityX * targetVelocityX + targetVelocityY * targetVelocityY
      dq = 1 - dq * this._whInvSq
      if (dq < 0) dq = 0
      p._update(targetVelocityX * dq, targetVelocityY * dq)
    }
    
    this.context.stroke()
    this.context.closePath()

    // draw particle
    p.drawParticle(this.context)

    // 如果粒子飞出了canvas的范围
    if (!IsInArea(p.x, p.y, this.width, this.height)) {
      if (this.params.isReflected) {
        this._reflectParticle(p)
      } else {
        p.init(
          this.width,
          this.height,
          2,
          this.params.radius_min,
          this.params.radius_max,
          this.params.color_particle,
          this.params.speed,
          this.params.life
        )
      }
    }
  }
  this.context.draw()
}

pJS.prototype.start = function () {
  this.runner = setInterval(()=>{
    this._update()
  }, 1000 / 60)
}

pJS.prototype.stop = function() {
  clearInterval(this.runner)
}

//#endregion
//--------------------------------------------------------------------------------------------------------------

/**
 * 创建一个ParticleJS实例
 * 需要在小程序的wxml里面实现写好一个canvas元素。示例如下, 注意要带有一个id
 * <canvas style="width: 300px; height: 200px;" canvas-id="firstCanvas" id="firstCanvas" ></canvas>
 * 需要指定id和长宽，然后把id传入参数里面去
 * 构造函数会自己创建context
 * 因为使用了wx.createSelectorQuery()，所以需要1.4.0基础库支持
 * @param  {string} tag_id
 * @param  {object} params
 */
var ParticleJS = function (tag_id, params) {

  var _params = Object.assign({}, DEFAULT_PARAMS)
  _params = Object.assign(_params, params)

  return new Promise((resolve, reject) => {
    wx.createSelectorQuery().select('#' + tag_id).boundingClientRect().exec(function (res){
      resolve({
        width: res[0].width,
        height: res[0].height
      })
    })
  })
  .then(dim => {
    var context = wx.createCanvasContext(tag_id)
    this.pJS = new pJS(context, dim.width, dim.height, _params)
    this.pJS.init()
    this.pJS.start()
    return this
  })
  .catch(e => {
    console.error(e);
    return null
  })
}

ParticleJS.prototype.setTouch = function (x, y) {
  this.pJS._touchPos = {x,y}
}

ParticleJS.prototype.clearTouch = function () {
  this.pJS._touchPos = null
}

ParticleJS.prototype.init = function () {
  this.pJS.init()
}

ParticleJS.prototype.destroy = function () {
  if (this.pJS) {
    this.pJS.stop()
    this.pJS = null
  }
}
module.exports = ParticleJS