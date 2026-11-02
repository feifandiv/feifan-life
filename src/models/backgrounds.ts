import lake from '../../assets/backgrounds/lake.jpg';
import snow from '../../assets/backgrounds/snow.jpg';
import mist from '../../assets/backgrounds/mist.jpg';

export const BUILTIN_BACKGROUNDS: Record<string, { name: string; url: string }> = {
  lake: { name: '湖畔森林', url: lake },
  snow: { name: '雪山晴空', url: snow },
  mist: { name: '雾山晨光', url: mist },
};
export const BACKGROUND_OPTIONS = {
  lake: '湖畔森林', snow: '雪山晴空', mist: '雾山晨光', solid: '纯色', custom: '自定义图片',
};
