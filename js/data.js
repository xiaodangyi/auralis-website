export const MODULES = [
  {
    id: "imaging",
    name: "分子成像",
    en: "Molecular Imaging",
    icon: "microscope",
    desc: "高分辨显微与多模态成像系统，让研究者在细胞与分子尺度观察真实过程。",
    tags: ["高分辨显微", "多模态融合", "实时重建"],
    faceIcon: "microscope",
    layout: ["dna", "atom", "flask-conical", "pill", "microscope", "shield-check", "activity", "bar-chart-3", "cross"]
  },
  {
    id: "diagnostics",
    name: "诊断分析",
    en: "Diagnostics",
    icon: "flask-conical",
    desc: "覆盖样本前处理到结果报告的自动化诊断链路，兼顾速度与可追溯性。",
    tags: ["样本前处理", "结果质控", "审计追溯"],
    faceIcon: "flask-conical",
    layout: ["atom", "dna", "flask-conical", "activity", "bar-chart-3", "shield-check", "microscope", "cross", "pill"]
  },
  {
    id: "automation",
    name: "实验室自动化",
    en: "Lab Automation",
    icon: "atom",
    desc: "模块化机械臂与智能调度系统，把重复操作交给高精度设备。",
    tags: ["模块化机械臂", "智能调度", "连续运行"],
    faceIcon: "atom",
    layout: ["flask-conical", "atom", "dna", "bar-chart-3", "activity", "microscope", "cross", "shield-check", "pill"]
  },
  {
    id: "data",
    name: "数据智能",
    en: "Data Intelligence",
    icon: "bar-chart-3",
    desc: "多源数据融合与临床决策支持，把复杂实验转化为清晰结论。",
    tags: ["多源融合", "实时监控", "决策支持"],
    faceIcon: "bar-chart-3",
    layout: ["dna", "activity", "bar-chart-3", "microscope", "atom", "flask-conical", "shield-check", "pill", "cross"]
  },
  {
    id: "medicine",
    name: "精准药物",
    en: "Precision Medicine",
    icon: "pill",
    desc: "从药物筛选到个体化方案，以数据驱动的方式匹配最合适的治疗路径。",
    tags: ["药物筛选", "个体化方案", "疗效监测"],
    faceIcon: "pill",
    layout: ["pill", "dna", "atom", "flask-conical", "microscope", "bar-chart-3", "activity", "shield-check", "cross"]
  },
  {
    id: "safety",
    name: "临床安全",
    en: "Clinical Safety",
    icon: "shield-check",
    desc: "面向血站与检验科的全链路安全体系，覆盖样本、设备和数据节点。",
    tags: ["异常拦截", "全链路追溯", "合规审计"],
    faceIcon: "shield-check",
    layout: ["shield-check", "cross", "activity", "bar-chart-3", "dna", "atom", "pill", "microscope", "flask-conical"]
  }
];

export const FACE_NAMES = ["+X", "-X", "+Y", "-Y", "+Z", "-Z"];
