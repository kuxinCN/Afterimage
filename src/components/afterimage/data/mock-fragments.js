/* 余像 Afterimage · 模拟数据（全部为虚构示例，非真实用户内容）
 * B / C 后续用真实故事数据替换本文件即可，组件不依赖此文件。
 * 数据格式见 README.md「数据格式」。
 * 数据集：standard（标准）/ edgeCases（边界）/ duplicateIds（重复 id）/ empty（空）。
 */
(function (global) {
  'use strict';

  /* 标准数据集：虚构故事《没说出口的再见》
   * 背景：高三那年，好友林小满转学前一天约「我」在旧站台见面，
   * 「我」因为赌气没有去。多年后想起，仍希望当时能好好道别。
   */
  var standard = [
    {
      id: 'photo-01',
      kind: 'photo',
      title: '站台合影',
      position: { x: 16, y: 32 },
      content: '一张微微泛白的拍立得：旧站台的雨棚下，两个穿校服的身影挤在画面中央，背后是慢车进站的白雾。\n\n照片背面有一行褪色的圆珠笔字：「等考上同一座城市，就天天见面。」\n\n那是转学前一周拍的。当时谁都以为，告别是一件可以推迟的事。'
    },
    {
      id: 'note-01',
      kind: 'note',
      title: '没发出的短信',
      position: { x: 42, y: 22 },
      content: '草稿箱里躺着一段打了又删的话：\n\n「小满，明天我就不去送你了。不是生气，是怕在站台上哭出来太丢人。你到了新学校要记得吃早饭，别总把胃疼当小事。」\n\n发送键始终没有按下去。第二天，对方坐上了 17:42 的慢车，而「我」在教室窗边看着那个方向，直到铃声响起。'
    },
    {
      id: 'ticket-01',
      kind: 'ticket',
      title: '没用上的车票',
      position: { x: 86, y: 60 },
      content: '一张提前买好的短途车票，目的地是邻市——小满新家所在的城市。\n\n出发日期被铅笔圈了又划掉。票根边缘起了毛，像被反复摩挲过很多次。\n\n它从来没有被检票口剪过。有些旅程在出发之前，就已经结束了。'
    },
    {
      id: 'clock-01',
      kind: 'clock',
      title: '停在 17:42 的钟',
      position: { x: 62, y: 68 },
      content: '旧站台候车室的挂钟，据说停在了那趟慢车发车的时刻：17:42。\n\n后来车站翻新，钟被拆下来，不知被谁收进了这间记忆的房间。\n\n每次看到它，都会想起那个问题：如果当时去了站台，现在的一切会不会不一样？'
    },
    {
      id: 'cup-01',
      kind: 'cup',
      title: '另一只杯子',
      position: { x: 29, y: 66 },
      content: '奶茶店的双杯托盘上，另一杯热可可始终没有人动过。\n\n那是约好「见面再说」的下午，对方等到奶茶凉透，把杯子留在桌上，只带走了一句「那，保重」。\n\n杯壁上的水珠早就干了，甜味却好像还留在空气里。'
    }
  ];

  /* 边界用例数据集：验证组件在异常输入下不崩溃、内容仍可访问 */
  var edgeCases = [
    {
      id: 'edge-long-title',
      kind: 'note',
      title: '这是一个特别特别长的标题，用来验证碎片标签会被安全地截断成省略号，而详情面板里的完整标题可以正常换行显示，不会撑破布局也不会溢出页面',
      content: '标题很长，但内容很短。标签应显示省略号，面板应完整展示标题。'
    },
    {
      id: 'edge-long-content',
      kind: 'photo',
      title: '很长内容的碎片',
      content: '以下是一段用来测试滚动的长文本。\n\n' +
        '记忆像一间没有窗的房间，我们在里面来回走动，把每一件旧物拿起又放下。有些东西被摸得发亮，有些东西落满灰尘。它们并不说话，只是安静地证明：那些日子确实存在过。\n\n'.repeat(6) +
        '如果这段文字可以顺畅滚动、关闭按钮始终可见，那么长内容场景通过。'
    },
    {
      id: 'edge-no-content',
      kind: 'cup',
      title: '没有文字的碎片',
      content: ''
    },
    {
      id: 'edge-no-title',
      kind: 'clock',
      content: '这条数据没有 title 字段，组件应回退为「未命名碎片」。'
    },
    {
      id: 'edge-unknown-kind',
      kind: 'hologram',
      title: '未知类型',
      content: 'kind 不在已知类型中时，应回退为通用纪念物图形，而不是报错。'
    },
    {
      id: 'edge-no-position',
      kind: 'ticket',
      title: '无坐标碎片',
      content: '没有 position 字段时，组件应自动分配一个安全的默认位置。'
    }
  ];

  /* 重复 id 数据集：验证 setFragments 去重（保留首次出现，忽略后续重复） */
  var duplicateIds = [
    { id: 'dup-01', kind: 'photo', title: '首次出现的照片（应保留）', content: 'id 为 dup-01 的第一条，应当被保留并展示。' },
    { id: 'dup-02', kind: 'note', title: '首次出现的纸条（应保留）', content: 'id 为 dup-02 的第一条，应当被保留并展示。' },
    { id: 'dup-01', kind: 'cup', title: '重复 id 的杯子（应被忽略）', content: '这条与第一条 id 重复，应当被忽略，不产生第二个 dup-01 按钮。' },
    { id: 'dup-03', kind: 'clock', title: '钟（唯一 id）', content: 'id 为 dup-03，唯一，应当保留。' },
    { id: 'dup-02', kind: 'ticket', title: '重复 id 的车票（应被忽略）', content: '这条与第二条 id 重复，应当被忽略。' }
  ];

  global.AfterimageMock = {
    standard: standard,
    edgeCases: edgeCases,
    duplicateIds: duplicateIds,
    empty: []
  };
})(window);