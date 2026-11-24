const featureIcons = new Set(['FileCheck', 'Landmark', 'Factory', 'ClipboardList', 'Settings', 'Store']);

const invalidFeature = (message) => {
  throw Object.assign(new Error(message), { statusCode: 400 });
};

module.exports = (cards) => {
  if (!Array.isArray(cards) || cards.length > 12) {
    invalidFeature('Business Essentials must contain no more than 12 feature cards');
  }
  const keys = new Set();
  return cards.map((card) => {
    if (!card || typeof card !== 'object' || Array.isArray(card)) {
      invalidFeature('A Business Essentials feature card must be an object');
    }
    const feature = Object.fromEntries(
      ['key', 'title', 'subtitle', 'icon', 'image', 'path', 'isActive', 'order']
        .filter((field) => card[field] !== undefined)
        .map((field) => [field, card[field]])
    );
    if (
      typeof feature.key !== 'string' || !/^[a-z0-9][a-z0-9-]{0,80}$/.test(feature.key)
      || typeof feature.title !== 'string' || !feature.title.trim() || feature.title.length > 100
      || typeof feature.subtitle !== 'string' || !feature.subtitle.trim() || feature.subtitle.length > 160
      || typeof feature.path !== 'string' || !/^\/(?!\/)[A-Za-z0-9][A-Za-z0-9/_-]*\/?$/.test(feature.path)
      || (feature.icon !== undefined && !featureIcons.has(feature.icon))
      || (feature.image !== undefined && (
        typeof feature.image !== 'string' || feature.image.length > 500
        || (feature.image && !/^\/(?!\/)[A-Za-z0-9][A-Za-z0-9/_.,%?-]*$/.test(feature.image) && !/^https:\/\//i.test(feature.image))
      ))
      || (feature.isActive !== undefined && typeof feature.isActive !== 'boolean')
      || (feature.order !== undefined && (!Number.isInteger(feature.order) || feature.order < 0 || feature.order > 1000))
    ) {
      invalidFeature('A Business Essentials feature card contains invalid fields');
    }
    if (keys.has(feature.key)) invalidFeature('Business Essentials feature keys must be unique');
    keys.add(feature.key);
    return {
      key: feature.key.trim(),
      title: feature.title.trim(),
      subtitle: feature.subtitle.trim(),
      icon: feature.icon || 'FileCheck',
      image: feature.image || '',
      path: feature.path,
      isActive: feature.isActive !== false,
      order: feature.order ?? 0
    };
  });
};
