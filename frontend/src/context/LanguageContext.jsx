import React, { createContext, useContext, useState, useEffect } from 'react';

const translations = {
  en: {
    // Navbar
    'nav.home': 'Home',
    'nav.draft': 'Draft Mode',
    'nav.fun': 'Fun Mode',
    'nav.tournament': 'Tournament',
    'nav.mapveto': 'Map Veto',
    // Home
    'home.title': 'Valorant Utilities',
    'home.subtitle': 'A complete toolkit for your custom games and tournaments.',
    'home.draft.desc': 'Competitive pick and ban simulator for two teams.',
    'home.fun.desc': 'Randomize your agent composition and assign roles.',
    'home.tournament.desc': 'Generate brackets, track scores, and manage your custom events.',
    'home.mapveto.desc': 'Pick and ban maps for competitive series.',
    // Map Veto
    'veto.setup.title': 'Map Veto Setup',
    'veto.setup.bo1': 'Best of 1',
    'veto.setup.bo3': 'Best of 3',
    'veto.setup.bo5': 'Best of 5',
    'veto.setup.start': 'Start Map Veto',
    'veto.turn': 'Turn',
    'veto.stolen': 'Turn missed! Stolen by',
    'veto.bans': 'Bans',
    'veto.picks': 'Picks',
    'veto.decider': 'Decider',
    'veto.lockin': 'Lock In',
    'veto.new': 'New Veto',
    // Fun Mode
    'fun.title': 'Agent Roulette',
    'fun.roll': 'Roll Agents',
    'fun.clear': 'Clear',
    'fun.roles.all': 'Any Role',
    'fun.roles.strict': 'Strict Meta (2x Init, 1x Duel, 1x Cont, 1x Sent)',
    'fun.roles.duelist': '5 Duelists',
    'fun.roster': 'Agent Roster (Click to Ban)',
    // Draft Mode
    'draft.setup': 'Draft Setup',
    'draft.start': 'Start Draft',
    'draft.team1': 'Team 1 Name',
    'draft.team2': 'Team 2 Name',
    'draft.banphase': 'Ban Phase',
    'draft.pickphase': 'Pick Phase',
    'draft.concluded': 'Draft Concluded',
    'draft.bans': 'Bans',
    'draft.picks': 'Picks',
    'draft.lockin': 'Lock In',
    // Tournament
    'tourn.setup': 'Tournament Setup',
    'tourn.format': 'Tournament Format',
    'tourn.single': 'Single Elimination',
    'tourn.double': 'Double Elimination',
    'tourn.swiss': 'Swiss Stage',
    'tourn.group': 'Group Stage',
    'tourn.notbuilt': 'Canvas renderer not yet built for this mode. Will show placeholder.',
    'tourn.teams': 'Total Players/Teams',
    'tourn.teams.count': 'Teams',
    'tourn.maprule': 'Map Selection Rule',
    'tourn.maprule.host': 'Map picked by host',
    'tourn.maprule.random': 'Random Map',
    'tourn.draftrule': 'Draft Mode',
    'tourn.draftrule.banpick': 'Ban & Pick',
    'tourn.draftrule.pick': 'Pick Only',
    'tourn.draftrule.none': 'None',
    'tourn.reg': 'Team Registration',
    'tourn.rand': 'Randomize',
    'tourn.seed': 'Seed',
    'tourn.gen': 'GENERATE BRACKET',
    'tourn.load': 'LOAD SAVE',
    'tourn.settings': 'Settings',
    'tourn.export': 'Export PNG',
    'tourn.save': 'Save JSON',
    'tourn.bracket': 'TOURNAMENT BRACKET',
    'tourn.map.tbd': 'MAP: TBD (CLICK)',
    'tourn.map.select': 'Select Map for Match'
  },
  vi: {
    // Navbar
    'nav.home': 'Trang chủ',
    'nav.draft': 'Cấm/Chọn Tướng',
    'nav.fun': 'Chế độ Giải Trí',
    'nav.tournament': 'Giải đấu',
    'nav.mapveto': 'Cấm/Chọn Bản đồ',
    // Home
    'home.title': 'Công cụ Valorant',
    'home.subtitle': 'Bộ công cụ hoàn chỉnh cho các trận đấu tùy chọn và giải đấu.',
    'home.draft.desc': 'Trình giả lập cấm/chọn tướng thi đấu cho hai đội.',
    'home.fun.desc': 'Quay ngẫu nhiên đội hình và chỉ định vai trò.',
    'home.tournament.desc': 'Tạo nhánh đấu, theo dõi tỉ số, và quản lý giải đấu của bạn.',
    'home.mapveto.desc': 'Cấm và chọn bản đồ cho loạt trận thi đấu.',
    // Map Veto
    'veto.setup.title': 'Cài đặt Cấm/Chọn Bản đồ',
    'veto.setup.bo1': 'BO1 (Đấu 1 trận)',
    'veto.setup.bo3': 'BO3 (Đấu 3 trận)',
    'veto.setup.bo5': 'BO5 (Đấu 5 trận)',
    'veto.setup.start': 'Bắt đầu Cấm/Chọn',
    'veto.turn': 'Lượt của',
    'veto.stolen': 'Bỏ lỡ lượt! Đã bị cướp bởi',
    'veto.bans': 'Cấm',
    'veto.picks': 'Chọn',
    'veto.decider': 'Quyết định',
    'veto.lockin': 'Khóa lựa chọn',
    'veto.new': 'Tạo mới',
    // Fun Mode
    'fun.title': 'Quay Tướng',
    'fun.roll': 'Quay',
    'fun.clear': 'Xóa',
    'fun.roles.all': 'Mọi vai trò',
    'fun.roles.strict': 'Meta Chuẩn (2x Khởi tranh, 1x Đối đầu, 1x Kiểm soát, 1x Hộ vệ)',
    'fun.roles.duelist': '5 Đối đầu',
    'fun.roster': 'Danh sách Tướng (Nhấp để Cấm)',
    // Draft Mode
    'draft.setup': 'Cài đặt Cấm/Chọn',
    'draft.start': 'Bắt đầu Cấm/Chọn',
    'draft.team1': 'Tên Đội 1',
    'draft.team2': 'Tên Đội 2',
    'draft.banphase': 'Giai đoạn Cấm',
    'draft.pickphase': 'Giai đoạn Chọn',
    'draft.concluded': 'Hoàn tất Cấm/Chọn',
    'draft.bans': 'Cấm',
    'draft.picks': 'Chọn',
    'draft.lockin': 'Khóa lựa chọn',
    // Tournament
    'tourn.setup': 'Cài đặt Giải đấu',
    'tourn.format': 'Thể thức',
    'tourn.single': 'Loại trực tiếp',
    'tourn.double': 'Nhánh thắng nhánh thua',
    'tourn.swiss': 'Thể thức Thụy Sĩ',
    'tourn.group': 'Vòng bảng',
    'tourn.notbuilt': 'Chế độ này chưa có tính năng vẽ sơ đồ. Sẽ hiển thị tạm thời.',
    'tourn.teams': 'Tổng số Người chơi/Đội',
    'tourn.teams.count': 'Đội',
    'tourn.maprule': 'Luật chọn bản đồ',
    'tourn.maprule.host': 'Host chọn',
    'tourn.maprule.random': 'Ngẫu nhiên',
    'tourn.draftrule': 'Luật Cấm/Chọn tướng',
    'tourn.draftrule.banpick': 'Cấm & Chọn',
    'tourn.draftrule.pick': 'Chỉ Chọn',
    'tourn.draftrule.none': 'Không',
    'tourn.reg': 'Đăng ký Đội',
    'tourn.rand': 'Xáo trộn ngẫu nhiên',
    'tourn.seed': 'Hạt giống',
    'tourn.gen': 'TẠO NHÁNH ĐẤU',
    'tourn.load': 'TẢI BẢN LƯU',
    'tourn.settings': 'Cài đặt',
    'tourn.export': 'Xuất ảnh PNG',
    'tourn.save': 'Lưu file JSON',
    'tourn.bracket': 'NHÁNH ĐẤU',
    'tourn.map.tbd': 'BẢN ĐỒ: CHƯA RÕ (NHẤP)',
    'tourn.map.select': 'Chọn bản đồ cho trận đấu'
  }
};

const LanguageContext = createContext();

export const LanguageProvider = ({ children }) => {
  const [language, setLanguage] = useState(localStorage.getItem('language') || 'en');

  useEffect(() => {
    localStorage.setItem('language', language);
  }, [language]);

  const t = (key) => {
    return translations[language][key] || key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => useContext(LanguageContext);
