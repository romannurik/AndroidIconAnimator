export const ModelUtil = {
  getOrderedAnimationBlocksByLayerIdAndProperty(animation) {
    let animationBlocksByLayerId = {};

    animation.blocks.forEach(block => {
      let animations = animationBlocksByLayerId[block.layerId];
      if (!animations) {
        animations = {};
        animationBlocksByLayerId[block.layerId] = animations;
      }

      animations[block.propertyName] = animations[block.propertyName] || [];
      animations[block.propertyName].push(block);
    });

    for (let layerId in animationBlocksByLayerId) {
      let animations = animationBlocksByLayerId[layerId];
      for (let propertyName in animations) {
        animations[propertyName].sort((a, b) => a.startTime - b.startTime);
      }
    }

    return animationBlocksByLayerId;
  },

  getUniqueId(opts) {
    opts = opts || {};
    opts.prefix = opts.prefix || '';
    opts.objectById = opts.objectById || (() => null);
    opts.targetObject = opts.targetObject || null;

    let n = 0;
    let id_ = () => opts.prefix + (n ? `_${n}` : '');
    while (true) {
      let o = opts.objectById(id_());
      if (!o || o == opts.targetObject) {
        break;
      }

      ++n;
    }

    return id_();
  }
};
