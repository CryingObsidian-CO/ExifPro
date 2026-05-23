import "../plugin-api";
import {ExifInfo, Group} from "../plugin-api";

type TestResult = {
  name: string;
  success: boolean;
  message: string;
};

// 事件日志项类型
type EventLogItem = {
  event: string;
  args?: Record<string, any>;
};

let testResults: TestResult[] = [];
let eventLog: EventLogItem[] = [];

function log(msg: string) {
  exifProHostAPI.log(msg);
}

function assert(name: string, condition: boolean, passMsg: string, failMsg: string) {
  testResults.push(
      {name: name, success: condition, message: condition ? passMsg : failMsg});
}

function printTestSummary() {
  log("=== 测试结果汇总 ===");
  let passed = 0;
  for (const r of testResults) {
    log((r.success ? "✅" : "❌") + " " + r.name + ": " + r.message);
    if (r.success) {
      passed++;
    }
  }
  log("总计: " + passed + "/" + testResults.length + " 通过 (" + ((passed
      / testResults.length) * 100).toFixed(1) + "%)");
}

function isValidGroup(g: unknown): g is Group {
  return (
      g !== null &&
      typeof g === "object" &&
      "id" in (g as Group) &&
      typeof (g as Group).id === "string" &&
      (g as Group).id.length > 0 &&
      "name" in (g as Group) &&
      typeof (g as Group).name === "string" &&
      (g as Group).name.length > 0 &&
      "group_type" in (g as Group) &&
      typeof (g as Group).group_type === "string" &&
      "photos" in (g as Group) &&
      Array.isArray((g as Group).photos)
  );
}

function isValidExifInfo(p: unknown): p is ExifInfo {
  return (
      p !== null &&
      typeof p === "object" &&
      "file_path" in (p as ExifInfo) &&
      typeof (p as ExifInfo).file_path === "string" &&
      typeof (p as ExifInfo).file_name === "string"
  );
}

function testLog() {
  log("--- API: log ---");
  try {
    exifProHostAPI.log("log 正常字符串");
    assert("log_basic", true, "正常字符串不抛异常", "");
  } catch (e) {
    assert("log_basic", false, "", "正常字符串抛异常: " + e);
  }

  try {
    exifProHostAPI.log("");
    assert("log_empty", true, "空字符串不抛异常", "");
  } catch (e) {
    assert("log_empty", false, "", "空字符串抛异常: " + e);
  }

  try {
    exifProHostAPI.log("特殊字符: \n\t\r\"'<>&中文🎉");
    assert("log_special_chars", true, "特殊字符不抛异常", "");
  } catch (e) {
    assert("log_special_chars", false, "", "特殊字符抛异常: " + e);
  }
}

function testGetPluginConfig() {
  log("--- API: getPluginConfig ---");
  try {
    const config = exifProHostAPI.getPluginConfig();

    assert("config_type",
        typeof config === 'object' && config !== null && !Array.isArray(config),
        "返回值为对象", "返回值类型: " + typeof config);

    assert("config_has_test_count", 'test_count' in config,
        "包含 test_count 字段", "缺少 test_count 字段");

    assert("config_has_test_mode", 'test_mode' in config, "包含 test_mode 字段",
        "缺少 test_mode 字段");

    assert("config_has_verbose_log", 'verbose_log' in config,
        "包含 verbose_log 字段", "缺少 verbose_log 字段");

    assert("config_has_test_threshold", 'test_threshold' in config,
        "包含 test_threshold 字段", "缺少 test_threshold 字段");

    if ('test_count' in config) {
      assert("config_test_count_type",
          typeof config.test_count === 'number' && Number.isInteger(
              config.test_count), "test_count 类型为 integer: " + config.test_count,
          "test_count 类型错误: " + typeof config.test_count);
    }

    if ('test_mode' in config) {
      assert("config_test_mode_type", typeof config.test_mode === 'string',
          "test_mode 类型为 string: \"" + config.test_mode + "\"",
          "test_mode 类型错误: " + typeof config.test_mode);
    }

    if ('verbose_log' in config) {
      assert("config_verbose_log_type", typeof config.verbose_log === 'boolean',
          "verbose_log 类型为 boolean: " + config.verbose_log,
          "verbose_log 类型错误: " + typeof config.verbose_log);
    }

    if ('test_threshold' in config) {
      assert("config_test_threshold_type",
          typeof config.test_threshold === 'number' && !Number.isInteger(
              config.test_threshold),
          "test_threshold 类型为 number: " + config.test_threshold,
          "test_threshold 类型错误: " + typeof config.test_threshold);
    }
  } catch (e) {
    assert("config_no_throw", false, "", "getPluginConfig 抛异常: " + e);
  }
}

function testGetGroups() {
  log("--- API: getGroups ---");
  try {
    const groups = exifProHostAPI.getGroups();

    assert("getGroups_type", Array.isArray(groups), "返回数组",
        "返回值类型: " + typeof groups);

    if (Array.isArray(groups)) {
      assert("getGroups_elements_valid", groups.every(function (g) {
        return isValidGroup(g);
      }), "所有分组结构有效", "存在结构无效的分组");

      if (groups.length > 0) {
        const first = groups[0];
        assert("getGroups_id_is_string", typeof first.id === 'string',
            "group.id 为 string", "group.id 类型: " + typeof first.id);
        assert("getGroups_name_is_string", typeof first.name === 'string',
            "group.name 为 string", "group.name 类型: " + typeof first.name);
        assert("getGroups_type_is_string", typeof first.group_type === 'string',
            "group.group_type 为 string",
            "group.group_type 类型: " + typeof first.group_type);
        assert("getGroups_photos_is_array", Array.isArray(first.photos),
            "group.photos 为数组", "group.photos 类型: " + typeof first.photos);

        if (Array.isArray(first.photos) && first.photos.length > 0) {
          assert("getGroups_photo_structure", isValidExifInfo(first.photos[0]),
              "照片结构有效 (file_path + file_name)", "照片结构无效");
        }
      }
    }
  } catch (e) {
    assert("getGroups_no_throw", false, "", "getGroups 抛异常: " + e);
  }
}

async function testReadFile() {
  log("--- API: readFile ---");
  try {
    const content = await exifProHostAPI.readFile("index.ts");
    assert("readFile_type", typeof content === 'string', "返回 string",
        "返回类型: " + typeof content);
    assert("readFile_not_empty", content.length > 0,
        "内容非空: " + content.length + " 字符", "内容为空");
    assert("readFile_content_valid", content.includes("exifProHostAPI"),
        "内容包含预期关键字", "内容不包含预期关键字");
  } catch (e) {
    assert("readFile_no_throw", false, "",
        "readFile(\"index.ts\") 抛异常: " + e);
  }

  try {
    await exifProHostAPI.readFile("non_existent_file_12345.txt");
    assert("readFile_not_found", false, "", "读取不存在的文件未抛异常");
  } catch (e) {
    assert("readFile_not_found", true, "读取不存在的文件正确抛异常: " + e, "");
  }
}

async function testReadFileBinary() {
  log("--- API: readFileBinary ---");
  try {
    const data = await exifProHostAPI.readFileBinary("index.ts");
    assert("readFileBinary_type", data instanceof Uint8Array, "返回 Uint8Array",
        "返回类型: " + typeof data);
    assert("readFileBinary_not_empty", data.length > 0,
        "数据非空: " + data.length + " 字节", "数据为空");
  } catch (e) {
    assert("readFileBinary_no_throw", false, "",
        "readFileBinary(\"index.ts\") 抛异常: " + e);
  }

  try {
    await exifProHostAPI.readFileBinary("non_existent_file_12345.bin");
    assert("readFileBinary_not_found", false, "", "读取不存在的文件未抛异常");
  } catch (e) {
    assert("readFileBinary_not_found", true, "读取不存在的文件正确抛异常: " + e,
        "");
  }
}

async function testWriteAndReadFile() {
  log("--- API: writeFile + readExternalFile 写入读回测试 ---");
  const textContent = "Hello ExifPro! 测试中文 🎉 timestamp=" + Date.now();
  const textPath = "test_text_" + Date.now() + ".txt";

  try {
    const encoded = new TextEncoder().encode(textContent);
    await exifProHostAPI.writeFile(textPath, encoded);
    assert("writeFile_text_no_throw", true, "写入文本文件成功", "");

    const readBackBytes = await exifProHostAPI.readExternalFile(textPath);
    const readBack = new TextDecoder().decode(readBackBytes);
    assert("write_read_text_match", readBack === textContent,
        "文本写入后读回一致: \"" + readBack.substring(0, 30) + "...\"",
        "文本写入后读回不一致: 期望 \"" + textContent.substring(0, 30)
        + "...\" 实际 \"" + (readBack ? readBack.substring(0, 30) : "null")
        + "...\"");
  } catch (e) {
    assert("writeFile_text_no_throw", false, "", "写入文本文件抛异常: " + e);
  }

  log("--- API: writeFile + readExternalFile 二进制写入读回测试 ---");
  const binaryPath = "test_binary_" + Date.now() + ".dat";
  const binaryData = new Uint8Array(
      [0x00, 0x01, 0x7F, 0x80, 0xFF, 0xDE, 0xAD, 0xBE, 0xEF]);

  try {
    await exifProHostAPI.writeFile(binaryPath, binaryData);
    assert("writeFile_binary_no_throw", true, "写入二进制文件成功", "");

    const readBinary = await exifProHostAPI.readExternalFile(binaryPath);
    assert("readExternalFile_type_check", readBinary instanceof Uint8Array,
        "读取返回 Uint8Array", "返回类型: " + typeof readBinary);

    assert("readExternalFile_length", readBinary.length === binaryData.length,
        "长度一致: " + readBinary.length + " 字节",
        "长度不一致: 期望 " + binaryData.length + " 实际 " + readBinary.length);

    if (readBinary.length === binaryData.length) {
      let allMatch = true;
      let mismatchIndex = -1;
      for (let i = 0; i < binaryData.length; i++) {
        if (binaryData[i] !== readBinary[i]) {
          allMatch = false;
          mismatchIndex = i;
          break;
        }
      }
      assert("readExternalFile_content", allMatch, "二进制内容逐字节匹配",
          "字节不匹配: 位置 " + mismatchIndex + ", 期望 0x" + String(
              binaryData[mismatchIndex] || 0) + " 实际 0x" + String(
              readBinary[mismatchIndex] || 0));
    }
  } catch (e) {
    assert("writeFile_binary_no_throw", false, "",
        "写入二进制文件抛异常: " + String(e) + "\nStack: " + (e instanceof Error
            ? e.stack : ""));
  }

  log("--- API: writeFile 空数据 ---");
  try {
    const emptyPath = "test_empty_" + Date.now() + ".dat";
    await exifProHostAPI.writeFile(emptyPath, new Uint8Array(0));
    assert("writeFile_empty_data", true, "写入空 Uint8Array 不抛异常", "");
  } catch (e) {
    assert("writeFile_empty_data", false, "", "写入空数据抛异常: " + e);
  }
}

async function testCreateDirectory() {
  log("--- API: createDirectory ---");
  const dirPath = "test_dir_" + Date.now();
  try {
    await exifProHostAPI.createDirectory(dirPath);
    assert("createDirectory_no_throw", true, "创建目录成功: " + dirPath, "");
  } catch (e) {
    assert("createDirectory_no_throw", false, "", "创建目录抛异常: " + e);
  }

  try {
    await exifProHostAPI.createDirectory("");
    assert("createDirectory_empty_path", false, "", "空路径未抛异常");
  } catch (e) {
    assert("createDirectory_empty_path", true, "空路径正确抛异常: " + e, "");
  }
}

async function testReadExternalFile() {
  log("--- API: readExternalFile ---");
  try {
    await exifProHostAPI.readExternalFile("C:\\Windows\\System32\\drivers\\etc\\hosts");
    assert("readExternalFile_hostname", false, "", "读取系统文件成功（不应该！）");
  } catch (e) {
    assert("readExternalFile_hostname", String(e).includes("traversal") || String(e).includes("Absolute paths"),
        "读取系统文件正确拒绝: " + String(e),
        "读取系统文件异常类型不对: " + String(e));
  }

  try {
    await exifProHostAPI.readExternalFile("/non/existent/path/file.txt");
    assert("readExternalFile_not_found", false, "",
        "读取不存在的外部文件未抛异常");
  } catch (e) {
    assert("readExternalFile_not_found", true, "读取不存在的外部文件正确抛异常",
        "");
  }
}

async function runGroupTests(sourceGroup: Group) {
  log("=== 开始分组操作完整测试 ===");
  testResults = [];
  eventLog = [];

  const groupCountBefore = exifProHostAPI.getGroups().length;

  if (sourceGroup.photos.length < 3) {
    assert("prerequisite", false, "",
        "需要至少 3 张照片，当前只有 " + sourceGroup.photos.length + " 张");
    printTestSummary();
    return;
  }

  const photo1 = sourceGroup.photos[0];
  const photo2 = sourceGroup.photos[1];
  const photo3 = sourceGroup.photos[2];

  log("--- API: createGroup ---");
  eventLog = [];
  const groupA = exifProHostAPI.createGroup([photo1], "Single",
      "测试A_" + Date.now());

  assert("createGroup_return_not_null", groupA !== null, "返回非 null",
      "返回 null");

  if (groupA) {
    assert("createGroup_structure_valid", isValidGroup(groupA), "返回结构有效",
        "返回结构无效");
    assert("createGroup_id_not_empty",
        typeof groupA.id === 'string' && groupA.id.length > 0,
        "id 非空: \"" + groupA.id + "\"", "id 无效");
    assert("createGroup_name_matches", groupA.name.startsWith("测试A_"),
        "name 匹配: \"" + groupA.name + "\"",
        "name 不匹配: \"" + groupA.name + "\"");
    assert("createGroup_type_matches", groupA.group_type === "Single",
        "group_type 匹配: \"" + groupA.group_type + "\"",
        "group_type 不匹配: \"" + groupA.group_type + "\"");
    assert("createGroup_photos_count", groupA.photos.length === 1,
        "照片数量: " + groupA.photos.length + " (期望 1)",
        "照片数量: " + groupA.photos.length + " (期望 1)");

    const groupsAfterCreate = exifProHostAPI.getGroups();
    assert("createGroup_count_increased",
        groupsAfterCreate.length === groupCountBefore + 1,
        "分组数量: " + groupCountBefore + " -> " + groupsAfterCreate.length
        + " (+1)",
        "分组数量: " + groupCountBefore + " -> " + groupsAfterCreate.length
        + " (期望 +1)");

    const foundInList = groupsAfterCreate.some(function (g) {
      return g.id === groupA.id;
    });
    assert("createGroup_appears_in_list", foundInList,
        "新建分组出现在 getGroups() 中", "新建分组未出现在 getGroups() 中");

    assert("createGroup_onGroupCreated_fired", eventLog.some(function (e) {
      return e.event === "onGroupCreated";
    }), "onGroupCreated 事件已触发", "onGroupCreated 事件未触发");
  }

  log("--- API: createGroup 空照片 ---");
  eventLog = [];
  const emptyGroup = exifProHostAPI.createGroup([], "Single",
      "测试空_" + Date.now());
  assert("createGroup_empty_photos", emptyGroup !== null,
      "空照片数组创建分组返回非 null (分组存在但无照片)",
      "空照片数组创建分组返回 null");

  if (emptyGroup) {
    assert("createGroup_empty_photos_count", emptyGroup.photos.length === 0,
        "空照片分组 photos 为空数组",
        "空照片分组 photos 不为空: " + emptyGroup.photos.length);
  }

  log("--- API: createGroup 第二个分组 ---");
  eventLog = [];
  const groupB = exifProHostAPI.createGroup([photo2], "Single",
      "测试B_" + Date.now());
  assert("createGroup_second", groupB !== null, "第二个分组创建成功",
      "第二个分组创建失败");

  if (groupB && groupA) {
    assert("createGroup_second_different_id", groupB.id !== groupA.id,
        "两个分组 id 不同", "两个分组 id 相同");
    assert("createGroup_second_onGroupCreated", eventLog.some(function (e) {
      return e.event === "onGroupCreated";
    }), "第二次 onGroupCreated 已触发", "第二次 onGroupCreated 未触发");
  }

  log("--- API: moveToGroup ---");
  if (groupA && groupB) {
    eventLog = [];
    const moveResult = exifProHostAPI.moveToGroup(groupA.id, [photo3]);
    assert("moveToGroup_return_true", moveResult === true, "返回 true",
        "返回 " + moveResult);

    const groupAfterMove = exifProHostAPI.getGroups().find(function (g) {
      return g.id === groupA.id;
    });
    if (groupAfterMove) {
      assert("moveToGroup_photo_added", groupAfterMove.photos.length === 2,
          "移动后照片数: " + groupAfterMove.photos.length + " (期望 2)",
          "移动后照片数: " + groupAfterMove.photos.length + " (期望 2)");
    }

    assert("moveToGroup_onMoveToGroup_fired", eventLog.some(function (e) {
      return e.event === "onMoveToGroup";
    }), "onMoveToGroup 事件已触发", "onMoveToGroup 事件未触发");
  }

  log("--- API: moveToGroup 无效 groupId ---");
  eventLog = [];
  const moveInvalidResult = exifProHostAPI.moveToGroup("non_existent_id_12345",
      [photo1]);
  assert("moveToGroup_invalid_id", moveInvalidResult === false,
      "无效 groupId 返回 false", "无效 groupId 返回 " + moveInvalidResult);
  assert("moveToGroup_invalid_no_event", !eventLog.some(function (e) {
    return e.event === "onMoveToGroup";
  }), "无效移动未触发 onMoveToGroup", "无效移动仍触发了 onMoveToGroup");

  log("--- API: mergeGroups ---");
  if (groupA && groupB) {
    eventLog = [];
    const countBeforeMerge = exifProHostAPI.getGroups().length;
    const mergedGroup = exifProHostAPI.mergeGroups([groupA.id, groupB.id],
        "合并测试_" + Date.now());

    assert("mergeGroups_return_not_null", mergedGroup !== null, "返回非 null",
        "返回 null");

    if (mergedGroup) {
      assert("mergeGroups_structure_valid", isValidGroup(mergedGroup),
          "返回结构有效", "返回结构无效");
      assert("mergeGroups_photos_merged", mergedGroup.photos.length === 3,
          "合并后照片数: " + mergedGroup.photos.length + " (期望 3)",
          "合并后照片数: " + mergedGroup.photos.length + " (期望 3)");

      const countAfterMerge = exifProHostAPI.getGroups().length;
      assert("mergeGroups_count_decreased",
          countAfterMerge === countBeforeMerge - 1,
          "合并后分组数: " + countBeforeMerge + " -> " + countAfterMerge
          + " (4)",
          "合并后分组数: " + countBeforeMerge + " -> " + countAfterMerge
          + " (期望 4)");

      const originalsRemoved = !exifProHostAPI.getGroups().some(function (g) {
        return g.id === groupA.id || g.id === groupB.id;
      });
      assert("mergeGroups_originals_removed", originalsRemoved,
          "原始分组已被移除", "原始分组仍存在");

      assert("mergeGroups_onGroupMerged_fired", eventLog.some(function (e) {
        return e.event === "onGroupMerged";
      }), "onGroupMerged 事件已触发", "onGroupMerged 事件未触发");

      log("--- API: disbandGroup ---");
      eventLog = [];
      const countBeforeDisband = exifProHostAPI.getGroups().length;
      const disbandedPhotos = exifProHostAPI.disbandGroup(mergedGroup.id);

      assert("disbandGroup_return_photos", disbandedPhotos.length === 3,
          "返回 " + disbandedPhotos.length + " 张照片 (期望 3)",
          "返回 " + disbandedPhotos.length + " 张照片 (期望 3)");

      const countAfterDisband = exifProHostAPI.getGroups().length;
      assert("disbandGroup_count_decreased",
          countAfterDisband === countBeforeDisband - 1,
          "解散后分组数: " + countBeforeDisband + " -> " + countAfterDisband
          + " (3)",
          "解散后分组数: " + countBeforeDisband + " -> " + countAfterDisband
          + " (期望 3)");

      const mergedRemoved = !exifProHostAPI.getGroups().some(function (g) {
        return g.id === mergedGroup.id;
      });
      assert("disbandGroup_removed_from_list", mergedRemoved,
          "解散的分组已从列表移除", "解散的分组仍在列表中");

      assert("disbandGroup_onGroupDisband_fired", eventLog.some(function (e) {
        return e.event === "onGroupDisband";
      }), "onGroupDisband 事件已触发", "onGroupDisband 事件未触发");

      log("--- API: disbandGroup 无效 groupId ---");
      eventLog = [];
      const disbandInvalid = exifProHostAPI.disbandGroup(
          "non_existent_id_12345");
      assert("disbandGroup_invalid_id", disbandInvalid.length === 0,
          "无效 groupId 返回空数组",
          "无效 groupId 返回 " + disbandInvalid.length + " 个元素");
      assert("disbandGroup_invalid_no_event", !eventLog.some(function (e) {
        return e.event === "onGroupDisband";
      }), "无效解散未触发 onGroupDisband", "无效解散仍触发了 onGroupDisband");
    }
  }

  log("--- API: mergeGroups 无效 groupIds ---");
  eventLog = [];
  const mergeInvalid = exifProHostAPI.mergeGroups(
      ["non_existent_1", "non_existent_2"], "无效合并");
  assert("mergeGroups_invalid_ids", mergeInvalid === null,
      "无效 groupIds 返回 null", "无效 groupIds 返回非 null");
  assert("mergeGroups_invalid_no_event", !eventLog.some(function (e) {
    return e.event === "onGroupMerged";
  }), "无效合并未触发 onGroupMerged", "无效合并仍触发了 onGroupMerged");

  printTestSummary();
}

exports.default = {
  async onLoad() {
    log("=== 插件功能测试工具已加载 ===");

    testLog();
    testGetPluginConfig();
    testGetGroups();
    await testReadFile();
    await testReadFileBinary();
    await testWriteAndReadFile();
    await testCreateDirectory();
    await testReadExternalFile();

    printTestSummary();
    log("如需测试分组操作，请点击分组上的「完整分组测试」按钮。");
    log("如需测试图片操作，请点击照片上的「测试图片操作」按钮。");
  },

  onUnload() {
    log("=== 插件功能测试工具已卸载 ===");
  },

  onRegisterUIExtensions() {
    return {
      groupActions: [{
        id: "test_group_action",
        label: "完整分组测试",
        icon: "🧪",
        groupTypes: ["FocusBracketing", "AEB", "Burst"],
      },], imageActions: [{
        id: "test_image_action", label: "测试图片操作", icon: "📷",
      },],
    };
  },

  async onGroupAction(actionId, group) {
    if (actionId === "test_group_action") {
      await runGroupTests(group);
    }
  },

  async onImageAction(actionId, photo) {
    if (actionId !== "test_image_action") {
      return;
    }

    log("=== 开始图片操作测试 ===");
    testResults = [];

    assert("imageAction_triggered", true, "onImageAction 触发成功", "");
    assert("imageAction_photo_valid", isValidExifInfo(photo), "照片结构有效",
        "照片结构无效");
    printTestSummary();
  },

  onParseExif(exif) {
    eventLog.push({event: "onParseExif", args: {count: exif.length}});
    return exif;
  },

  onGroupCreated(group) {
    eventLog.push({event: "onGroupCreated", args: {name: group.name}});
    return group;
  },

  onMoveToGroup(group, photos) {
    eventLog.push({
      event: "onMoveToGroup",
      args: {name: group.name, photoCount: photos.length}
    });
  },

  onGroupMerged(originalGroups, mergedGroup) {
    eventLog.push({
      event: "onGroupMerged",
      args: {originalCount: originalGroups.length, mergedName: mergedGroup.name}
    });
  },

  onGroupUpdated(group, updates) {
    eventLog.push(
        {event: "onGroupUpdated", args: {name: group.name, updates: updates}});
  },

  onGroupDisband(group) {
    eventLog.push({event: "onGroupDisband", args: {name: group.name}});
  },
};
