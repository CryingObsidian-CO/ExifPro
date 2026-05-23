import "../plugin-api";

exports.default = {
  onLoad() {
    exifProHostAPI.log("插件加载成功");
  },

  onUnload() {
    console.log("插件卸载");
  }
};