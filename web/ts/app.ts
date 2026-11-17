const API = '';

interface Song {
  id: string;
  title: string;
  channel: string;
  thumbnail?: string;
  duration?: number;
  duration_string?: string;
  url?: string;
  favorite?: boolean;
  local?: boolean;
  downloaded?: boolean;
  provided?: boolean;
  kind?: 'quran';
  stream_url?: string;
  arabic?: string;
  reciter_id?: number;
  chapter_id?: number;
  verses_count?: number;
}

interface Playlist {
  name: string;
  songs: Song[];
}

interface Library {
  songs: Song[];
  playlists: Playlist[];
}

type LoopMode = 'off' | 'one';
type SortMode = 'added' | 'title' | 'channel';

// --- APP LANGUAGE ---
type Lang = 'en' | 'ta';
type Vars = Record<string, string | number>;

let uiLang: Lang = load<string>('ns_lang', 'en') === 'ta' ? 'ta' : 'en';

const I18N: Record<Lang, Record<string, string>> = {
  en: {
    'nav.search': 'Search',
    'nav.library': 'Your Library',
    'nav.recent': 'Recently Played',
    'nav.favorites': 'Liked Nasheeds',
    'nav.downloads': 'Downloads',
    'nav.local': 'Your Nasheeds',
    'nav.provided': 'Provided Nasheeds',
    'nav.quran': 'Quran',
    'nav.settings': 'Settings',
    'sidebar.playlists': 'Playlists',
    'sidebar.intent': 'Made for the Quran & nasheeds, not general music.',
    'menu.open': 'Open menu',
    'menu.close': 'Close menu',
    'search.placeholder': 'Search',
    'search.hint': 'What do you want to listen to?',
    'search.recents': 'Recent searches',
    'search.clear_all': 'Clear all',
    'search.empty_title': 'Search for nasheeds',
    'search.empty_sub1': 'Find and play nasheeds from YouTube',
    'search.empty_sub2': 'Made for the Quran & nasheeds, not general music',
    'search.searching': 'Searching...',
    'search.no_results': 'No results found',
    'search.failed': 'Search failed',
    'search.no_recent': 'No recent searches',
    'search.recent_one': 'Recent search',
    'time.just_now': 'Just now',
    'time.min_ago': '{n} min ago',
    'time.hr_ago': '{n} hr ago',
    'time.yesterday': 'Yesterday',
    'time.days_ago': '{n} days ago',
    'search.no_match': 'No results for "{q}"',
    'search.aria': 'Search nasheeds',
    'search.close': 'Close search',
    'sort.added': 'Recently added',
    'sort.title': 'Title A–Z',
    'sort.channel': 'Channel',
    'sort.label': 'Sort',
    'lib.empty_title': 'Nothing here yet',
    'lib.empty_sub': 'Search and save nasheeds to see them here',
    'lib.empty_downloads_title': 'No downloads yet',
    'lib.empty_downloads_sub': 'Hit the download button on any nasheed to save it for offline listening',
    'lib.empty_local_title': 'No local nasheeds yet',
    'lib.empty_local_sub': 'Add your own mp3 or mp4 files with the + button above',
    'lib.count': '{n} nasheed{s}',
    'lib.rename': 'Rename playlist',
    'lib.delete': 'Delete playlist',
    'lib.add_local': 'Add your own nasheeds',
    'lib.play': 'Play',
    'lib.shuffle': 'Shuffle play',
    'lib.local_channel': 'Local nasheeds',
    'provided.sub': 'Nasheeds provided by the Quran app',
    'provided.refresh': 'Refresh provided nasheeds',
    'provided.loading': 'Loading provided nasheeds...',
    'provided.count': '{n} provided nasheed{s}',
    'provided.empty_title': 'No provided nasheeds yet',
    'provided.empty_sub': 'New nasheeds will appear here as they are added to the catalog.',
    'provided.err_title': 'Catalog unavailable',
    'provided.err_sub': 'Could not load provided nasheeds. Check your connection and try again.',
    'quran.sub': 'Listen to the Quran',
    'quran.play_all': 'Play all surahs',
    'quran.shuffle': 'Shuffle play',
    'quran.reciter': 'Reciter',
    'quran.reciter_browse': 'Browse & search reciters',
    'quran.reciter_prev': 'Previous reciter',
    'quran.reciter_next': 'Next reciter',
    'quran.reciter_aria': 'Choose reciter',
    'quran.ayah_label': 'Ayah',
    'quran.ayah_prev': 'Previous ayah',
    'quran.ayah_next': 'Next ayah',
    'quran.ayah_jump_aria': 'Go to ayah',
    'quran.ayah_ph': 'Ayah',
    'quran.ayah_go': 'Go to ayah',
    'quran.pick': 'Choose surah',
    'quran.hint': 'Choose a surah to read',
    'quran.filter_ph': 'Filter surahs',
    'quran.filter_clear': 'Clear filter',
    'quran.unavailable': 'Quran unavailable',
    'quran.load_err': 'Could not load surahs',
    'quran.retry': 'Try again',
    'quran.loading': 'Loading Quran...',
    'quran.count': '{n} surahs',
    'quran.count_reciter': '{n} surahs · {r}',
    'quran.no_match': 'No surahs match "{q}"',
    'quran.trans_off_arabic': 'Arabic only',
    'quran.trans_err': 'Could not load ayahs',
    'quran.trans_loading': 'Loading ayahs...',
    'quran.makkah': 'Makkah',
    'quran.madinah': 'Madinah',
    'quran.n_ayahs': '{n} ayahs',
    'quran.surah_has': 'Surah has {n} ayahs',
    'quran.search_surahs': 'Search surahs…',
    'quran.no_surahs': 'No surahs found',
    'quran.count_of': '{a} of {b} surahs',
    'quran.pick_reciter_title': 'Choose reciter',
    'quran.search_reciters': 'Search reciters…',
    'quran.no_reciters': 'No reciters found',
    'quran.reciters_count': '{n} reciters',
    'quran.reciters_count_of': '{a} of {b} reciters',
    'player.idle': 'No track playing',
    'player.shuffle': 'Shuffle',
    'player.loop': 'Loop',
    'player.prev': 'Previous',
    'player.next': 'Next',
    'player.stop': 'Stop',
    'player.vol': 'Volume',
    'player.seek': 'Seek',
    'player.yt': 'See on YouTube',
    'player.dl': 'Download for offline',
    'player.dl_mp3': 'Download MP3',
    'player.dl_active': 'Downloading, click to cancel',
    'player.dl_done': 'Downloaded, click to remove',
    'row.play': 'Play',
    'row.like': 'Like',
    'row.add_pl': 'Add to playlist',
    'row.dl': 'Download for offline',
    'row.yt': 'See on YouTube',
    'row.disc_shown': 'Shown in Discord',
    'row.disc_hidden': 'Hidden from Discord',
    'row.read': 'Read',
    'row.remove': 'Remove',
    'row.remove_named': 'Remove {q}',
    'modal.cancel': 'Cancel',
    'modal.create': 'Create',
    'modal.rename_ok': 'Rename',
    'pl.new': 'New playlist',
    'pl.new_ph': 'Playlist name',
    'pl.rename': 'Rename playlist',
    'pl.remove_title': 'Remove from playlist',
    'pl.remove_q': 'Remove "{t}" from {p}?',
    'pl.remove_lib_title': 'Remove from library',
    'pl.remove_lib_q': 'Remove "{t}" from Your Library?',
    'pl.delete_title': 'Delete playlist',
    'pl.delete_q': 'Delete "{p}"? It will be removed from your playlists.',
    'pl.created': 'Created playlist: {p}',
    'pl.deleted': 'Deleted playlist: {p}',
    'pl.rename_done': 'Renamed to {p}',
    'pl.delete_fail': 'Could not delete playlist',
    'pl.added': 'Added to {p}',
    'pl.removed': 'Removed from {p}',
    'pl.removed_lib': 'Removed from Your Library',
    'fav.denied_quran': 'Quran cannot be liked',
    'fav.failed': 'Could not update liked nasheeds',
    'fav.liked': 'Added to Liked Nasheeds',
    'fav.unliked': 'Removed from Liked Nasheeds',
    'dl.starting': 'Downloading "{t}"',
    'local.added': 'Added to Your Nasheeds',
    'local.added_n': 'Added {n} nasheeds to Your Nasheeds',
    'local.add_fail': 'Could not add {f}: {e}',
    'set.clear_history_q': 'Remove your recent searches and the nasheeds you played recently? Your library, playlists, downloads, and imported nasheeds stay.',
    'set.clear_cache_q': 'Clear cached stream links, Quran text, and catalogs? Playback keeps working, they just reload as you use the app.',
    'sc.restore': 'Restore',
    'sc.restore_aria': 'Restore recent searches',
    'dl.canceled': 'Download canceled',
    'dl.removed': 'Download removed',
    'dl.start_fail': 'Could not start download',
    'dl.done': 'Downloaded. Plays without wifi now',
    'dl.failed': 'Download failed',
    'dl.remove_title': 'Remove download',
    'dl.remove_q': 'Remove the downloaded copy of "{t}"? It will need wifi to play again.',
    'play.click_start': 'Click play to start',
    'play.fail': 'Playback failed, try again',
    'err.load_quran_audio': 'Could not load Quran audio',
    'err.load_nasheed': 'Could not load nasheed',
    'err.open_youtube': 'Could not open YouTube',
    'set.settings_sub': 'Make Quran feel right for you.',
    'set.language': 'Language',
    'set.language_sub': 'Use Quran in English or Tamil. The whole app switches right away.',
    'set.language_label': 'App language',
    'set.section_ui': 'UI',
    'set.section_ui_sub': 'App information and updates.',
    'set.about': 'About',
    'set.about_app': 'App',
    'set.about_version': 'Version',
    'set.about_repo': 'Repository',
    'set.updates': 'Updates',
    'set.updates_sub': 'Check for a newer release, or include early builds to try changes before they are stable.',
    'set.latest': 'Latest release',
    'set.unknown': 'Unknown',
    'set.unknown_lower': 'unknown',
    'set.prereleases': 'Pre-release builds',
    'set.check_updates': 'Check for updates',
    'set.update': 'Update',
    'set.run_new': 'Run new version',
    'set.app_note_title': 'About this app',
    'set.app_note_sub': 'Made for the Quran and nasheeds. Your library and preferences stay on this device. Online features connect to services such as YouTube, GitHub, and Discord when you use them.',
    'set.section_sound': 'Sound',
    'set.section_sound_sub': 'Choose the default volume for playback.',
    'set.sound_sub': 'Choose the volume used when Quran starts. You can still adjust it anytime in the player.',
    'set.default_vol': 'Default volume',
    'set.section_discord': 'Discord',
    'set.section_discord_sub': 'Control profile presence and connect your bot.',
    'set.presence': 'Discord presence',
    'set.presence_sub': 'Show your current nasheed or Quran recitation on your Discord profile. Discord desktop needs to be open. Use the eye button on a nasheed row to hide it.',
    'set.share_play': 'Share what I play',
    'set.dc_connected': 'Connected',
    'set.dc_connecting': 'Connecting...',
    'set.dc_not_running': 'Discord not running',
    'set.dc_err': 'Status unavailable',
    'set.dc_off': 'Off',
    'set.bot': 'Discord bot',
    'set.bot_sub': 'Run `su!track link` in your server, then enter the code below. The bot URL points to your bot service. Use Test to check that Quran can reach it. Hidden nasheeds are not shared.',
    'set.send_play': 'Send what I play',
    'set.bot_url': 'Bot URL',
    'set.bot_test': 'Test',
    'set.link_code': 'Link code',
    'set.link_ph': 'From su!track link',
    'set.link': 'Link',
    'set.unlink': 'Unlink',
    'set.bot_linked': 'Linked',
    'set.bot_linked_as': 'Linked as {name}',
    'set.bot_paused': 'Paused',
    'set.bot_paused_as': 'Paused as {name}',
    'set.bot_not_linked': 'Not linked',
    'set.section_data': 'Data',
    'set.section_data_sub': 'Clear what the app remembers on this device.',
    'set.history': 'History',
    'set.history_sub': 'Your recent searches and the nasheeds you played recently. Clearing it leaves your library, playlists, downloads, and imported nasheeds alone.',
    'set.recent_searches': 'Recent searches',
    'set.recent_played': 'Recently played',
    'set.clear_history': 'Clear history',
    'set.history_cleared': 'History cleared.',
    'set.lib_card': 'Library',
    'set.lib_sub': 'Pick what gets removed, then clear. Anything you leave out stays on this device; history and cache are never touched.',
    'set.nasheeds': 'Nasheeds',
    'set.playlists': 'Playlists',
    'set.downloads': 'Downloads',
    'set.local_nasheeds': 'Local nasheeds',
    'set.clear_library': 'Clear library',
    'set.lib_cleared': 'Library cleared.',
    'set.lib_clear_fail': 'Could not clear the library.',
    'set.cache': 'Cache',
    'set.cache_sub': 'Temporary data used to open streams, Quran text, and catalogs faster. Clearing it is safe: the app rebuilds it as you listen.',
    'set.stored_entries': 'Stored entries',
    'set.clear_cache': 'Clear cache',
    'set.cache_cleared': 'Cache cleared.',
    'set.cache_clear_fail': 'Could not clear the cache.',
    'set.clear_confirm': 'Remove {what} from this device? This cannot be undone. Everything left switched off stays, and your history and cache are not touched.',
    'set.part_nasheeds': 'your nasheeds and likes',
    'set.part_playlists': 'your playlists',
    'set.part_downloads': 'downloaded offline copies',
    'set.part_local': 'your imported local nasheeds',
    'set.word_and': 'and',
    'upd.checking': 'Checking GitHub...',
    'upd.no_installer': 'No installer available for this platform yet.',
    'upd.newest': 'You are on the newest release.',
    'upd.available': 'Version {tag} is available.',
    'upd.cached_showing': 'Showing cached results. ',
    'upd.reach_fail': 'Could not reach GitHub right now.',
    'upd.downloading': 'Downloading {tag}...',
    'upd.dl_progress': 'Downloading {a}{b}',
    'upd.failed': 'Update failed: {err}',
    'upd.check_first': 'Check for updates first.',
    'upd.already': 'You already have {tag} installed.',
    'upd.starting': 'Starting update to {tag}...',
    'upd.start_fail': 'Could not start the update.',
    'upd.reach_updater': 'Could not reach the updater.',
    'bot.testing': 'Testing...',
    'bot.reachable': 'Bot reachable, running v{v}',
    'bot.no_response': 'No response from the bot',
    'bot.last_fail': 'Last sync failed: {err}',
    'bot.unreachable': 'bot unreachable',
    'bot.backend_fail': 'Could not reach the app backend',
    'bot.linked_ok': 'Discord bot linked',
    'bot.unlinked_ok': 'Discord bot unlinked',
  },
  ta: {
    'nav.search': 'தேடல்',
    'nav.library': 'உங்கள் நூலகம்',
    'nav.recent': 'சமீபத்தில் கேட்டவை',
    'nav.favorites': 'பிடித்த நஷீத்கள்',
    'nav.downloads': 'பதிவிறக்கங்கள்',
    'nav.local': 'உங்கள் நஷீத்கள்',
    'nav.provided': 'வழங்கப்பட்ட நஷீத்கள்',
    'nav.quran': 'திருக்குர்ஆன்',
    'nav.settings': 'அமைப்புகள்',
    'sidebar.playlists': 'பிளேலிஸ்டுகள்',
    'sidebar.intent': 'திருக்குர்ஆன் மற்றும் நஷீத்களுக்காக உருவாக்கப்பட்டது; பொது இசைக்கு அல்ல.',
    'menu.open': 'பட்டியலைத் திற',
    'menu.close': 'பட்டியலை மூடு',
    'search.placeholder': 'தேடல்',
    'search.hint': 'எதைக் கேட்க விரும்புகிறீர்கள்?',
    'search.recents': 'சமீபத்திய தேடல்கள்',
    'search.clear_all': 'அனைத்தையும் அழி',
    'search.empty_title': 'நஷீத்களைத் தேடுங்கள்',
    'search.empty_sub1': 'YouTube-ல் நஷீத்களைக் கண்டறிந்து கேளுங்கள்',
    'search.empty_sub2': 'திருக்குர்ஆன் மற்றும் நஷீத்களுக்காக உருவாக்கப்பட்டது; பொது இசைக்கு அல்ல',
    'search.searching': 'தேடுகிறது...',
    'search.no_results': 'முடிவுகள் இல்லை',
    'search.failed': 'தேடல் தோல்வி',
    'search.no_recent': 'சமீபத்திய தேடல்கள் இல்லை',
    'search.recent_one': 'சமீபத்திய தேடல்',
    'time.just_now': 'இப்போது',
    'time.min_ago': '{n} நிமிடம் முன்பு',
    'time.hr_ago': '{n} மணி நேரம் முன்பு',
    'time.yesterday': 'நேற்று',
    'time.days_ago': '{n} நாட்களுக்கு முன்பு',
    'search.no_match': '"{q}"க்கு முடிவுகள் இல்லை',
    'search.aria': 'நஷீத்களைத் தேடு',
    'search.close': 'தேடலை மூடு',
    'sort.added': 'சமீபத்தில் சேர்க்கப்பட்டவை',
    'sort.title': 'தலைப்பு A–Z',
    'sort.channel': 'சேனல்',
    'sort.label': 'வரிசைப்படுத்து',
    'lib.empty_title': 'இங்கே இன்னும் எதுவும் இல்லை',
    'lib.empty_sub': 'நஷீத்களைத் தேடிச் சேமித்தால் அவை இங்கே தோன்றும்',
    'lib.empty_downloads_title': 'இன்னும் பதிவிறக்கங்கள் இல்லை',
    'lib.empty_downloads_sub': 'இணையம் இல்லாமல் கேட்க எந்த நஷீத்தின் மேலும் பதிவிறக்கப் பொத்தானை அழுத்துங்கள்',
    'lib.empty_local_title': 'இன்னும் உள்ளூர் நஷீத்கள் இல்லை',
    'lib.empty_local_sub': 'மேலே உள்ள + பொத்தானால் உங்கள் mp3 அல்லது mp4 கோப்புகளைச் சேருங்கள்',
    'lib.count': '{n} நஷீத்கள்',
    'lib.rename': 'பிளேலிஸ்டை மறுபெயரிடு',
    'lib.delete': 'பிளேலிஸ்டை நீக்கு',
    'lib.add_local': 'உங்கள் நஷீத்களைச் சேர்',
    'lib.play': 'இயக்கு',
    'lib.shuffle': 'கலைத்து இயக்கு',
    'lib.local_channel': 'உள்ளூர் நஷீத்கள்',
    'provided.sub': 'திருக்குர்ஆன் செயலி வழங்கும் நஷீத்கள்',
    'provided.refresh': 'வழங்கப்பட்ட நஷீத்களைப் புதுப்பி',
    'provided.loading': 'வழங்கப்பட்ட நஷீத்கள் ஏற்றப்படுகின்றன...',
    'provided.count': '{n} வழங்கப்பட்ட நஷீத்கள்',
    'provided.empty_title': 'இன்னும் வழங்கப்பட்ட நஷீத்கள் இல்லை',
    'provided.empty_sub': 'புதிய நஷீத்கள் பட்டியலில் சேர்க்கப்படும்போது இங்கே தோன்றும்.',
    'provided.err_title': 'பட்டியல் கிடைக்கவில்லை',
    'provided.err_sub': 'வழங்கப்பட்ட நஷீத்களை ஏற்ற முடியவில்லை. உங்கள் இணைப்பைச் சரிபார்த்து மீண்டும் முயற்சிக்கவும்.',
    'quran.sub': 'திருக்குர்ஆனைக் கேளுங்கள்',
    'quran.play_all': 'அனைத்து சூராக்களையும் இயக்கு',
    'quran.shuffle': 'கலைத்து இயக்கு',
    'quran.reciter': 'ஓதுபவர்',
    'quran.reciter_browse': 'ஓதுபவர்களைத் தேடு',
    'quran.reciter_prev': 'முந்தைய ஓதுபவர்',
    'quran.reciter_next': 'அடுத்த ஓதுபவர்',
    'quran.reciter_aria': 'ஓதுபவரைத் தேர்ந்தெடு',
    'quran.ayah_label': 'வசனம்',
    'quran.ayah_prev': 'முந்தைய வசனம்',
    'quran.ayah_next': 'அடுத்த வசனம்',
    'quran.ayah_jump_aria': 'வசனத்திற்குச் செல்',
    'quran.ayah_ph': 'வசனம்',
    'quran.ayah_go': 'வசனத்திற்குச் செல்',
    'quran.pick': 'சூராவைத் தேர்ந்தெடு',
    'quran.hint': 'படிக்க ஒரு சூராவைத் தேர்ந்தெடுங்கள்',
    'quran.filter_ph': 'சூராக்களை வடிகட்டு',
    'quran.filter_clear': 'வடிகட்டலை அழி',
    'quran.unavailable': 'திருக்குர்ஆன் கிடைக்கவில்லை',
    'quran.load_err': 'சூராக்களை ஏற்ற முடியவில்லை',
    'quran.retry': 'மீண்டும் முயற்சிக்கவும்',
    'quran.loading': 'திருக்குர்ஆன் ஏற்றப்படுகிறது...',
    'quran.count': '{n} சூராக்கள்',
    'quran.count_reciter': '{n} சூராக்கள் · {r}',
    'quran.no_match': '"{q}" உடன் பொருந்தும் சூராக்கள் இல்லை',
    'quran.trans_off_arabic': 'அரபு மட்டும்',
    'quran.trans_err': 'வசனங்களை ஏற்ற முடியவில்லை',
    'quran.trans_loading': 'வசனங்கள் ஏற்றப்படுகின்றன...',
    'quran.makkah': 'மக்கா',
    'quran.madinah': 'மதீனா',
    'quran.n_ayahs': '{n} வசனங்கள்',
    'quran.surah_has': 'இந்தச் சூராவில் {n} வசனங்கள்',
    'quran.search_surahs': 'சூராக்களைத் தேடு…',
    'quran.no_surahs': 'சூராக்கள் இல்லை',
    'quran.count_of': '{b} சூராக்களில் {a}',
    'quran.pick_reciter_title': 'ஓதுபவரைத் தேர்ந்தெடு',
    'quran.search_reciters': 'ஓதுபவர்களைத் தேடு…',
    'quran.no_reciters': 'ஓதுபவர்கள் இல்லை',
    'quran.reciters_count': '{n} ஓதுபவர்கள்',
    'quran.reciters_count_of': '{b} ஓதுபவர்களில் {a}',
    'player.idle': 'எதுவும் இயங்கவில்லை',
    'player.shuffle': 'கலைத்து இயக்கு',
    'player.loop': 'மறுஇயக்கம்',
    'player.prev': 'முந்தையது',
    'player.next': 'அடுத்தது',
    'player.stop': 'நிறுத்து',
    'player.vol': 'ஒலி அளவு',
    'player.seek': 'இடம் மாற்று',
    'player.yt': 'YouTube-ல் பார்க்க',
    'player.dl': 'இணையம் இல்லாமல் கேட்க பதிவிறக்கு',
    'player.dl_mp3': 'MP3 பதிவிறக்கு',
    'player.dl_active': 'பதிவிறக்குகிறது, ரத்து செய்ய அழுத்துங்கள்',
    'player.dl_done': 'பதிவிறக்கம் முடிந்தது, நீக்க அழுத்துங்கள்',
    'row.play': 'இயக்கு',
    'row.like': 'பிடித்தது',
    'row.add_pl': 'பிளேலிஸ்டில் சேர்',
    'row.dl': 'இணையம் இல்லாமல் கேட்க பதிவிறக்கு',
    'row.yt': 'YouTube-ல் பார்க்க',
    'row.disc_shown': 'Discord-ல் காட்டப்படுகிறது',
    'row.disc_hidden': 'Discord-ல் மறைக்கப்பட்டது',
    'row.read': 'படி',
    'row.remove': 'நீக்கு',
    'row.remove_named': '{q} நீக்கு',
    'modal.cancel': 'ரத்து',
    'modal.create': 'உருவாக்கு',
    'modal.rename_ok': 'மறுபெயரிடு',
    'pl.new': 'புதிய பிளேலிஸ்ட்',
    'pl.new_ph': 'பிளேலிஸ்ட் பெயர்',
    'pl.rename': 'பிளேலிஸ்டை மறுபெயரிடு',
    'pl.remove_title': 'பிளேலிஸ்டில் இருந்து நீக்கு',
    'pl.remove_q': '"{t}" ஐ {p} இல் இருந்து நீக்கவா?',
    'pl.remove_lib_title': 'நூலகத்தில் இருந்து நீக்கு',
    'pl.remove_lib_q': '"{t}" ஐ உங்கள் நூலகத்தில் இருந்து நீக்கவா?',
    'pl.delete_title': 'பிளேலிஸ்டை நீக்கு',
    'pl.delete_q': '"{p}" ஐ நீக்கவா? உங்கள் பிளேலிஸ்டுகளில் இருந்து நீக்கப்படும்.',
    'pl.created': 'பிளேலிஸ்ட் உருவாக்கப்பட்டது: {p}',
    'pl.deleted': 'பிளேலிஸ்ட் நீக்கப்பட்டது: {p}',
    'pl.rename_done': '{p} என மறுபெயரிடப்பட்டது',
    'pl.delete_fail': 'பிளேலிஸ்டை நீக்க முடியவில்லை',
    'pl.added': '{p} இல் சேர்க்கப்பட்டது',
    'pl.removed': '{p} இல் இருந்து நீக்கப்பட்டது',
    'pl.removed_lib': 'உங்கள் நூலகத்தில் இருந்து நீக்கப்பட்டது',
    'fav.denied_quran': 'திருக்குர்ஆனைப் பிடித்தாகச் சேமிக்க முடியாது',
    'fav.failed': 'பிடித்தாகச் சேமிப்பைப் புதுப்பிக்க முடியவில்லை',
    'fav.liked': 'பிடித்த நஷீடுகளில் சேர்க்கப்பட்டது',
    'fav.unliked': 'பிடித்த நஷீடுகளில் இருந்து நீக்கப்பட்டது',
    'dl.starting': '"{t}" பதிவிறக்கப்படுகிறது',
    'local.added': 'உங்கள் நஷீடுகளில் சேர்க்கப்பட்டது',
    'local.added_n': '{n} நஷீடுகள் உங்கள் நஷீடுகளில் சேர்க்கப்பட்டன',
    'local.add_fail': '{f} சேர்க்க முடியவில்லை: {e}',
    'set.clear_history_q': 'சமீபத்திய தேடல்களையும் சமீபத்தில் கேட்ட நஷீடுகளையும் நீக்கவா? நூலகம், பிளேலிஸ்டுகள், பதிவிறக்கங்கள் மற்றும் இறக்குமதி செய்த நஷீடுகள் அப்படியே இருக்கும்.',
    'set.clear_cache_q': 'தேடல் இணைப்புகள், திருக்குர்ஆன் உரை மற்றும் பட்டியல்களை அழிக்கவா? இயங்குவதில் பாதிப்பில்லை, தேவைப்படும்போது மீண்டும் ஏற்றப்படும்.',
    'sc.restore': 'மீட்டமை',
    'sc.restore_aria': 'சமீபத்திய தேடல்களை மீட்டமை',
    'dl.canceled': 'பதிவிறக்கம் ரத்து செய்யப்பட்டது',
    'dl.removed': 'பதிவிறக்கம் நீக்கப்பட்டது',
    'dl.start_fail': 'பதிவிறக்கத்தைத் தொடங்க முடியவில்லை',
    'dl.done': 'பதிவிறக்கம் முடிந்தது. இணையம் இல்லாமல் இப்போது கேட்கலாம்',
    'dl.failed': 'பதிவிறக்கம் தோல்வி',
    'dl.remove_title': 'பதிவிறக்கத்தை நீக்கு',
    'dl.remove_q': '"{t}" இன் பதிவிறக்கப்பட்ட நகலை நீக்கவா? மீண்டும் கேக்க இணையம் தேவைப்படும்.',
    'play.click_start': 'தொடங்க இயக்கை அழுத்துங்கள்',
    'play.fail': 'இயக்கம் தோல்வி, மீண்டும் முயற்சிக்கவும்',
    'err.load_quran_audio': 'திருக்குர்ஆன் ஒலியை ஏற்ற முடியவில்லை',
    'err.load_nasheed': 'நஷீத்தை ஏற்ற முடியவில்லை',
    'err.open_youtube': 'YouTube-ஐத் திறக்க முடியவில்லை',
    'set.settings_sub': 'செயலியை உங்களுக்கு ஏற்ப மாற்றுங்கள்.',
    'set.language': 'மொழி',
    'set.language_sub': 'இந்தச் செயலியை ஆங்கிலம் அல்லது தமிழில் பயன்படுத்துங்கள். மாற்றும்போது முழு செயலியும் உடனே மாறும்.',
    'set.language_label': 'செயலி மொழி',
    'set.section_ui': 'இடைமுகம்',
    'set.section_ui_sub': 'செயலி தகவல் மற்றும் புதுப்பிப்புகள்.',
    'set.about': 'பற்றி',
    'set.about_app': 'செயலி',
    'set.about_version': 'பதிப்பு',
    'set.about_repo': 'களஞ்சியம்',
    'set.updates': 'புதுப்பிப்புகள்',
    'set.updates_sub': 'புதிய பதிப்பு இருக்கிறதா எனப் பாருங்கள்; நிலையானதாக மாறும் முன்பே மாற்றங்களை முயற்சிக்க ஆரம்ப உருவாக்கங்களையும் சேர்க்கலாம்.',
    'set.latest': 'சமீபத்திய பதிப்பு',
    'set.unknown': 'தெரியவில்லை',
    'set.unknown_lower': 'தெரியவில்லை',
    'set.prereleases': 'ஆரம்ப கட்ட உருவாக்கங்கள்',
    'set.check_updates': 'புதுப்பிப்புகளைச் சரிபார்',
    'set.update': 'புதுப்பி',
    'set.run_new': 'புதிய பதிப்பை இயக்கு',
    'set.app_note_title': 'இந்தச் செயலியைப் பற்றி',
    'set.app_note_sub': 'திருக்குர்ஆன் மற்றும் நஷீத்களுக்காக உருவாக்கப்பட்டது. உங்கள் நூலகமும் விருப்பங்களும் இந்தச் சாதனத்திலேயே இருக்கும். நீங்கள் பயன்படுத்தும்போது YouTube, GitHub, Discord போன்ற சேவைகளுடன் இணைக்கிறது.',
    'set.section_sound': 'ஒலி',
    'set.section_sound_sub': 'இயக்கத்திற்கான இயல்புநிலை ஒலி அளவைத் தேர்ந்தெடுங்கள்.',
    'set.sound_sub': 'செயலி தொடங்கும்போது பயன்படுத்தும் ஒலி அளவைத் தேர்ந்தெடுங்கள். பிளேயரில் எப்போது வேண்டுமானாலும் மாற்றலாம்.',
    'set.default_vol': 'இயல்புநிலை ஒலி அளவு',
    'set.section_discord': 'Discord',
    'set.section_discord_sub': 'உங்கள் சுயவிவர இருப்பைக் கட்டுப்படுத்தி பாட்டை இணைக்கவும்.',
    'set.presence': 'Discord இருப்பு',
    'set.presence_sub': 'நீங்கள் இப்போது கேட்கும் நஷீத் அல்லது திருக்குர்ஆன் ஓதலை உங்கள் Discord சுயவிவரத்தில் காட்டுங்கள். Discord டெஸ்க்டாப் திறந்திருக்க வேண்டும். ஒரு நஷீத்தை மறைக்க அதன் வரிசையில் உள்ள கண் பொத்தானைப் பயன்படுத்துங்கள்.',
    'set.share_play': 'நான் கேட்பதைப் பகிர்',
    'set.dc_connected': 'இணைக்கப்பட்டது',
    'set.dc_connecting': 'இணைக்கிறது...',
    'set.dc_not_running': 'Discord இயங்கவில்லை',
    'set.dc_err': 'நிலை தெரியவில்லை',
    'set.dc_off': 'அணைவில்லை',
    'set.bot': 'Discord பாட்',
    'set.bot_sub': 'உங்கள் சர்வரில் `su!track link` என இயக்கி, கீழே குறியீட்டை உள்ளிடுங்கள். பாட் URL உங்கள் பாட் சேவையைச் சுட்டுகிறது. இணைப்பு வேலை செய்கிறதா என சோதனை பொத்தானால் பாருங்கள். மறைக்கப்பட்ட நஷீத்கள் பகிரப்படா.',
    'set.send_play': 'நான் கேட்பதை அனுப்பு',
    'set.bot_url': 'பாட் URL',
    'set.bot_test': 'சோதனை',
    'set.link_code': 'இணைப்புக் குறியீடு',
    'set.link_ph': 'su!track link-ல் கிடைத்தது',
    'set.link': 'இணை',
    'set.unlink': 'இணைப்பை நீக்கு',
    'set.bot_linked': 'இணைக்கப்பட்டது',
    'set.bot_linked_as': '{name} ஆக இணைக்கப்பட்டது',
    'set.bot_paused': 'இடைநிறுத்தப்பட்டது',
    'set.bot_paused_as': '{name} ஆக இடைநிறுத்தப்பட்டது',
    'set.bot_not_linked': 'இணைக்கவில்லை',
    'set.section_data': 'தரவு',
    'set.section_data_sub': 'செயலி இந்தச் சாதனத்தில் நினைவில் வைப்பவற்றை அழிக்கவும்.',
    'set.history': 'வரலாறு',
    'set.history_sub': 'உங்கள் சமீபத்திய தேடல்களும் சமீபத்தில் கேட்ட நஷீத்களும். இதை அழிப்பது நூலகம், பிளேலிஸ்டுகள், பதிவிறக்கங்கள், இறக்குமதி நஷீத்களைத் தொடாது.',
    'set.recent_searches': 'சமீபத்திய தேடல்கள்',
    'set.recent_played': 'சமீபத்தில் கேட்டவை',
    'set.clear_history': 'வரலாற்றை அழி',
    'set.history_cleared': 'வரலாறு அழிக்கப்பட்டது.',
    'set.lib_card': 'நூலகம்',
    'set.lib_sub': 'எதை நீக்க வேண்டும் என்று தேர்ந்தெடுத்து அழிக்கவும். நீங்கள் விட்டுவிடுவது இந்தச் சாதனத்திலேயே இருக்கும்; வரலாறும் தற்காலிக சேமிப்பும் தொடப்படா.',
    'set.nasheeds': 'நஷீத்கள்',
    'set.playlists': 'பிளேலிஸ்டுகள்',
    'set.downloads': 'பதிவிறக்கங்கள்',
    'set.local_nasheeds': 'உள்ளூர் நஷீத்கள்',
    'set.clear_library': 'நூலகத்தை அழி',
    'set.lib_cleared': 'நூலகம் அழிக்கப்பட்டது.',
    'set.lib_clear_fail': 'நூலகத்தை அழிக்க முடியவில்லை.',
    'set.cache': 'தற்காலிக சேமிப்பு',
    'set.cache_sub': 'ஸ்ட்ரீம்கள், திருக்குர்ஆன் உரை, பட்டியல்களை விரைவாகத் திறக்கப் பயன்படும் தற்காலிக தரவு. இதை அழிப்பது பாதுகாப்பானது: கேட்கும்போது செயலி அதை மீண்டும் உருவாக்குகிறது.',
    'set.stored_entries': 'சேமித்த உருப்படிகள்',
    'set.clear_cache': 'தற்காலிக சேமிப்பை அழி',
    'set.cache_cleared': 'தற்காலிக சேமிப்பு அழிக்கப்பட்டது.',
    'set.cache_clear_fail': 'தற்காலிக சேமிப்பை அழிக்க முடியவில்லை.',
    'set.clear_confirm': 'இந்தச் சாதனத்தில் இருந்து {what} நீக்கவா? இதை மீட்டல் முடியாது. அணைச்சலாக விட்டவை அப்படியே இருக்கும்; வரலாறும் தற்காலிக சேமிப்பும் தொடப்படா.',
    'set.part_nasheeds': 'உங்கள் நஷீத்களும் பிடித்தவையும்',
    'set.part_playlists': 'உங்கள் பிளேலிஸ்டுகள்',
    'set.part_downloads': 'பதிவிறக்கிய இணையமில்லா நகல்கள்',
    'set.part_local': 'நீங்கள் இறக்குமதி செய்த உள்ளூர் நஷீத்கள்',
    'set.word_and': 'மற்றும்',
    'upd.checking': 'GitHub-ஐச் சரிபார்க்கிறது...',
    'upd.no_installer': 'இந்தத் தளத்திற்கு இன்னும் நிறுவி கிடைக்கவில்லை.',
    'upd.newest': 'நீங்கள் சமீபத்திய பதிப்பில் இருக்கிறீர்கள்.',
    'upd.available': '{tag} பதிப்பு கிடைக்கிறது.',
    'upd.cached_showing': 'சேமித்த முடிவுகளைக் காட்டுகிறது. ',
    'upd.reach_fail': 'இப்போது GitHub-ஐ அடைய முடியவில்லை.',
    'upd.downloading': '{tag} பதிவிறக்குகிறது...',
    'upd.dl_progress': '{a}{b} பதிவிறக்குகிறது',
    'upd.failed': 'புதுப்பிப்பு தோல்வி: {err}',
    'upd.check_first': 'முதலில் புதுப்பிப்புகளைச் சரிபாருங்கள்.',
    'upd.already': '{tag} ஏற்கனவே நிறுவப்பட்டுள்ளது.',
    'upd.starting': '{tag} புதுப்பிப்பைத் தொடங்குகிறது...',
    'upd.start_fail': 'புதுப்பிப்பைத் தொடங்க முடியவில்லை.',
    'upd.reach_updater': 'புதுப்பிப்பாளரை அடைய முடியவில்லை.',
    'bot.testing': 'சோதிக்கிறது...',
    'bot.reachable': 'பாட் அணுகலாம், v{v} இயங்குகிறது',
    'bot.no_response': 'பாட்டிலிருந்து பதில் இல்லை',
    'bot.last_fail': 'கடைசி ஒத்திசைவு தோல்வி: {err}',
    'bot.unreachable': 'பாட் அணுக முடியவில்லை',
    'bot.backend_fail': 'செயலி பின்புலத்தை அடைய முடியவில்லை',
    'bot.linked_ok': 'Discord பாட் இணைக்கப்பட்டது',
    'bot.unlinked_ok': 'Discord பாட் இணைப்பு நீக்கப்பட்டது',
  },
};

function t(key: string, vars?: Vars): string {
  let s = I18N[uiLang][key];
  if (s == null) s = I18N.en[key];
  if (s == null) s = key;
  if (vars) {
    s = s.replace(/\{(\w+)\}/g, (_, k: string) => (vars[k] == null ? '{' + k + '}' : String(vars[k])));
  }
  return s;
}

function applyStaticI18n() {
  document.documentElement.lang = uiLang;
  $$('[data-i18n]').forEach((el) => {
    el.textContent = t(el.dataset.i18n as string);
  });
  $$('[data-i18n-title]').forEach((el) => {
    el.setAttribute('title', t(el.dataset.i18nTitle as string));
  });
  $$('[data-i18n-aria]').forEach((el) => {
    el.setAttribute('aria-label', t(el.dataset.i18nAria as string));
  });
  $$('[data-i18n-ph]').forEach((el) => {
    (el as HTMLInputElement).placeholder = t(el.dataset.i18nPh as string);
  });
  $$('.lang-opt').forEach((b) => {
    const on = b.dataset.uiLang === uiLang;
    b.classList.toggle('active', on);
    b.setAttribute('aria-pressed', on ? 'true' : 'false');
  });
}

function refreshForLang() {
  applyStaticI18n();
  $('#player-title').textContent = currentSong ? currentSong.title : t('player.idle');
  renderQuranList();
  renderQuranReadHead();
  syncQuranTranslation();
  scRenderRows(false);
  loadLibraryCounts();
  loadCacheCount();
  loadBot();
  if (discordEnabled) pollDiscordStatus();
  else setDiscordStatus('off');
  void loadLib(currentLibMode ?? 'library');
  loadPlaylists();
  if (currentSong) updatePlayer();
}

const audio = new Audio();
let queue: Song[] = [];
let queueIdx = -1;
let loopMode: LoopMode = 'off';
let currentSong: Song | null = null;
let progressDrag = false;
let currentList: Song[] = [];
let currentPlaylistName: string | null = null;
let shuffleOn = false;
let preShuffleQueue: Song[] = [];
let currentLibMode: string | undefined;
let currentLibSource: Song[] = [];
let sortMode: SortMode = 'added';
let startingId: string | null = null;
let buffering = false;
const downloadedIds = new Set<string>();
const dlActive = new Set<string>();
let dlPollTimer: number | undefined;


function $(s: string): HTMLElement {
  const el = document.querySelector<HTMLElement>(s);
  if (!el) throw new Error('missing element: ' + s);
  return el;
}
function $$<T extends HTMLElement = HTMLElement>(s: string): T[] {
  return Array.from(document.querySelectorAll<T>(s));
}
function esc(s?: string): string {
  const d = document.createElement('div');
  d.textContent = s || '';
  return d.innerHTML.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
function fmt(s: number): string {
  const m = Math.floor(s / 60);
  return m + ':' + String(Math.floor(s % 60)).padStart(2, '0');
}
async function getJSON<T>(url: string, init?: RequestInit): Promise<T> {
  const r = await fetch(url, init);
  const body = (await r.json().catch(() => null)) as unknown;
  if (!r.ok) {
    const err = new Error(`request failed: ${r.status}`) as Error & { status: number; body: unknown };
    err.status = r.status;
    err.body = body;
    throw err;
  }
  return body as T;
}
function toast(msg: string) {
  const t = document.createElement('div');
  t.className = 'toast';
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2200);
}

function store(key: string, val: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(val));
  } catch {}
}

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw == null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

function shuffleArr<T>(a: T[]): T[] {
  const r = a.slice();
  for (let i = r.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [r[i], r[j]] = [r[j], r[i]];
  }
  return r;
}

function recordRecent(song: Song) {
  const list = load<Song[]>('ns_recent', []).filter((s) => s.id !== song.id);
  list.unshift(song);
  store('ns_recent', list.slice(0, 50));
}

class Modal {
  private readonly backdrop: HTMLElement;
  private readonly panel: HTMLElement;
  private readonly onCloseCb: (() => void) | null;

  constructor(title: string, content: HTMLElement, onClose?: () => void, className?: string) {
    this.backdrop = document.createElement('div');
    this.backdrop.className = 'modal-backdrop';
    this.panel = document.createElement('div');
    this.panel.className = 'modal' + (className ? ` ${className}` : '');
    const h = document.createElement('div');
    h.className = 'modal-title';
    h.textContent = title;
    this.panel.append(h, content);
    this.backdrop.append(this.panel);
    this.panel.tabIndex = -1;
    this.onCloseCb = onClose ?? null;
    this.backdrop.addEventListener('click', (e) => {
      if (e.target === this.backdrop) this.close();
    });
    this.backdrop.addEventListener(
      'keydown',
      (e) => {
        if (e.key === 'Escape') this.close();
      },
      true
    );
    document.body.appendChild(this.backdrop);
    this.panel.focus();
  }

  close() {
    this.backdrop.remove();
    this.onCloseCb?.();
  }
}

function promptText(title: string, placeholder: string, okLabel: string, value = ''): Promise<string | null> {
  return new Promise((resolve) => {
    let done = false;
    const finish = (v: string | null) => {
      if (done) return;
      done = true;
      m.close();
      resolve(v);
    };
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'modal-input';
    input.placeholder = placeholder;
    input.value = value;
    input.spellcheck = false;
    const cancel = document.createElement('button');
    cancel.className = 'modal-btn';
    cancel.textContent = t('modal.cancel');
    const ok = document.createElement('button');
    ok.className = 'modal-btn modal-btn-primary';
    ok.textContent = okLabel;
    const row = document.createElement('div');
    row.className = 'modal-actions';
    row.append(cancel, ok);
    const wrap = document.createElement('div');
    wrap.className = 'modal-body';
    wrap.append(input, row);
    const m = new Modal(title, wrap, () => finish(null));
    const submit = () => {
      const v = input.value.trim();
      if (!v) {
        input.focus();
        return;
      }
      finish(v);
    };
    ok.addEventListener('click', submit);
    cancel.addEventListener('click', () => finish(null));
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') submit();
    });
    window.setTimeout(() => input.focus(), 30);
  });
}

function confirmDialog(title: string, message: string): Promise<boolean> {
  return new Promise((resolve) => {
    let done = false;
    const finish = (v: boolean) => {
      if (done) return;
      done = true;
      m.close();
      resolve(v);
    };
    const content = document.createElement('div');
    content.className = 'modal-body';
    const msg = document.createElement('div');
    msg.className = 'modal-msg';
    msg.textContent = message;
    const row = document.createElement('div');
    row.className = 'modal-actions';
    const cancel = document.createElement('button');
    cancel.className = 'modal-btn';
    cancel.textContent = t('modal.cancel');
    const del = document.createElement('button');
    del.className = 'modal-btn modal-btn-danger';
    del.innerHTML = '<i class="fa-solid fa-trash" style="margin-right:6px"></i>Delete';
    row.append(cancel, del);
    content.append(msg, row);
    const m = new Modal(title, content, () => finish(false));
    cancel.addEventListener('click', () => finish(false));
    del.addEventListener('click', () => finish(true));
    window.setTimeout(() => cancel.focus(), 30);
  });
}

async function showPlaylistPicker(): Promise<string | null> {
  const pls = await getJSON<Playlist[]>(`${API}/api/playlists`);
  return new Promise((resolve) => {
    let done = false;
    const finish = (v: string | null) => {
      if (done) return;
      done = true;
      m.close();
      resolve(v);
    };
    const content = document.createElement('div');
    content.className = 'modal-body';
    const list = document.createElement('div');
    list.className = 'modal-list';
    if (pls.length) {
      pls.forEach((pl) => {
        const opt = document.createElement('button');
        opt.className = 'modal-opt';
        opt.style.display = 'flex';
        opt.style.alignItems = 'center';
        opt.style.gap = '10px';
        opt.innerHTML = `<i class="fa-solid fa-list-ul" style="width:16px;text-align:center;color:#b3b3b3"></i><span style="flex:1">${esc(pl.name)}</span>`;
        opt.addEventListener('click', () => finish(pl.name));
        list.appendChild(opt);
      });
    } else {
      const hint = document.createElement('div');
      hint.className = 'modal-hint';
      hint.innerHTML = '<i class="fa-solid fa-circle-info" style="margin-right:8px"></i>No playlists yet';
      list.appendChild(hint);
    }
    const sep = document.createElement('div');
    sep.className = 'modal-sep';
    const newRow = document.createElement('div');
    newRow.className = 'modal-actions';
    const newBtn = document.createElement('button');
    newBtn.className = 'modal-btn modal-btn-primary';
    newBtn.innerHTML = '<i class="fa-solid fa-plus" style="margin-right:6px"></i>New playlist';
    newBtn.addEventListener('click', async () => {
      const name = await promptText(t('pl.new'), t('pl.new_ph'), t('modal.create'));
      if (!name) {
        finish(null);
        return;
      }
      await getJSON<{ ok: boolean }>(`${API}/api/playlists/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      loadPlaylists();
      finish(name);
    });
    newRow.append(newBtn);
    content.append(list, sep, newRow);
    const m = new Modal(t('row.add_pl'), content, () => finish(null));
  });
}

function showReciterPicker() {
  if (!quranReciters.length) return;
  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    m.close();
  };
  const content = document.createElement('div');
  content.className = 'modal-body reciter-picker';
  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'modal-input';
  input.placeholder = t('quran.search_reciters');
  input.spellcheck = false;
  const count = document.createElement('div');
  count.className = 'modal-hint reciter-picker-count';
  const list = document.createElement('div');
  list.className = 'modal-list reciter-picker-list';
  const render = (q: string) => {
    const term = q.trim().toLowerCase();
    const items = quranReciters.filter(
      (r) =>
        !term ||
        (r.label || '').toLowerCase().includes(term) ||
        r.reciter_name.toLowerCase().includes(term) ||
        (r.style || '').toLowerCase().includes(term)
    );
    list.innerHTML = '';
    if (!items.length) {
      const h = document.createElement('div');
      h.className = 'modal-hint';
      h.innerHTML = `<i class="fa-solid fa-magnifying-glass" style="margin-right:8px"></i>${esc(t('quran.no_reciters'))}`;
      list.appendChild(h);
    } else {
      items.forEach((r) => {
        const on = r.id === quranReciterId;
        const opt = document.createElement('button');
        opt.type = 'button';
        opt.className = 'modal-opt reciter-opt' + (on ? ' active' : '');
        opt.innerHTML = `
          <i class="fa-solid ${on ? 'fa-check' : 'fa-microphone-lines'}"></i>
          <span class="reciter-opt-text">
            <span class="reciter-opt-name">${esc(r.label || r.reciter_name)}</span>
            ${r.style ? `<span class="reciter-opt-style">${esc(r.style)}</span>` : ''}
          </span>`;
        opt.addEventListener('click', () => {
          applyQuranReciter(r.id, true);
          finish();
        });
        list.appendChild(opt);
      });
    }
    count.textContent = term
      ? t('quran.reciters_count_of', { a: items.length, b: quranReciters.length })
      : t('quran.reciters_count', { n: quranReciters.length });
  };
  input.addEventListener('input', () => render(input.value));
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const first = list.querySelector<HTMLElement>('.reciter-opt');
      if (first) {
        e.preventDefault();
        first.click();
      }
    }
  });
  content.append(input, count, list);
  const m = new Modal(t('quran.pick_reciter_title'), content, () => finish(), 'modal-reciter');
  render('');
  window.setTimeout(() => input.focus(), 30);
}

class Slider {
  private readonly root: HTMLElement;
  private readonly fill: HTMLElement;
  private readonly thumb: HTMLElement;
  private value = 0;
  private dragging = false;
  onInput: ((v: number) => void) | null = null;
  onChange: (() => void) | null = null;

  constructor(container: HTMLElement) {
    this.root = container;
    this.root.classList.add('slider');
    this.root.tabIndex = 0;
    const env = document.createElement('div');
    env.className = 'slider-env';
    this.fill = document.createElement('div');
    this.fill.className = 'slider-fill';
    this.thumb = document.createElement('div');
    this.thumb.className = 'slider-thumb';
    this.root.append(env, this.fill, this.thumb);

    this.root.addEventListener('pointerdown', (e) => this.onDown(e));
    this.root.addEventListener('pointermove', (e) => this.onMove(e));
    this.root.addEventListener('pointerup', (e) => this.onUp(e));
    this.root.addEventListener('pointercancel', () => this.endDrag());
    this.root.addEventListener('keydown', (e) => this.onKey(e));
  }

  private pos(pct: number): number {
    const rect = this.root.getBoundingClientRect();
    let p = ((pct - rect.left) / rect.width) * 100;
    return Math.max(0, Math.min(100, p));
  }

  private onDown(e: PointerEvent) {
    if (e.button !== undefined && e.button !== 0 && e.pointerType === 'mouse') return;
    this.dragging = true;
    this.root.classList.add('dragging');
    this.root.setPointerCapture(e.pointerId);
    this.setValue(this.pos(e.clientX));
    this.onInput?.(this.value);
  }

  private onMove(e: PointerEvent) {
    if (!this.dragging) return;
    this.setValue(this.pos(e.clientX));
    this.onInput?.(this.value);
  }

  private onUp(e: PointerEvent) {
    if (!this.dragging) return;
    this.setValue(this.pos(e.clientX));
    this.onInput?.(this.value);
    this.endDrag();
    this.onChange?.();
  }

  private endDrag() {
    this.dragging = false;
    this.root.classList.remove('dragging');
  }

  private onKey(e: KeyboardEvent) {
    let d = 0;
    if (e.key === 'ArrowRight') d = 1;
    else if (e.key === 'ArrowLeft') d = -1;
    else if (e.key === 'PageUp') d = 10;
    else if (e.key === 'PageDown') d = -10;
    else if (e.key === 'Home') d = -100;
    else if (e.key === 'End') d = 100;
    if (d) {
      e.preventDefault();
      const v = this.value + d;
      this.setValue(Math.max(0, Math.min(100, v)));
      this.onInput?.(this.value);
      this.onChange?.();
    }
  }

  setValue(v: number): number {
    this.value = Math.max(0, Math.min(100, v));
    this.fill.style.width = this.value + '%';
    this.thumb.style.left = this.value + '%';
    this.root.setAttribute('aria-valuenow', String(Math.round(this.value)));
    return this.value;
  }

  getValue(): number {
    return this.value;
  }
}

const $seekOrigin = $('#progress-bar');
const seek = new Slider($seekOrigin);
const $volOrigin = $('#volume-bar');
const vol = new Slider($volOrigin);

// --- NAVIGATION ---
function setSidebarOpen(open: boolean) {
  $('#sidebar').classList.toggle('open', open);
  $('#sidebar-backdrop').classList.toggle('show', open);
}
$('#menu-btn').addEventListener('click', () => setSidebarOpen(true));
$('#menu-close').addEventListener('click', () => setSidebarOpen(false));
$('#sidebar-backdrop').addEventListener('click', () => setSidebarOpen(false));
$('#playlist-nav').addEventListener('click', () => setSidebarOpen(false));

$$<HTMLElement>('.nav-item').forEach((btn) =>
  btn.addEventListener('click', () => {
    setSidebarOpen(false);
    $$<HTMLElement>('.nav-item').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    const v = btn.dataset.view;
    $$<HTMLElement>('.view').forEach((el) => el.classList.remove('active'));
    if (v === 'search') {
      $('#search-view').classList.add('active');
    } else if (v === 'quran') {
      $('#quran-view').classList.add('active');
      loadQuran();
    } else if (v === 'settings') {
      $('#settings-view').classList.add('active');
      void loadSettings();
    } else if (v === 'provided') {
      $('#provided-view').classList.add('active');
      void loadProvided();
    } else {
      $('#library-view').classList.add('active');
      loadLib(v);
    }
  })
);

// --- QURAN ---
interface QuranChapter {
  id: number;
  name_simple: string;
  name_arabic: string;
  name_complex?: string;
  verses_count: number;
  revelation_place?: string;
  translated_name?: { name: string };
}

interface QuranReciter {
  id: number;
  reciter_name: string;
  style?: string | null;
  label?: string;
  server?: string;
}

const QURAN_DEFAULT_RECITER = '123';

let quranChapters: QuranChapter[] = [];
let quranLoaded = false;
let quranReciters: QuranReciter[] = [];
let quranReciterId = Number(QURAN_DEFAULT_RECITER);
let readChapterId = Math.min(Math.max(Number(load<number>('ns_qread', 1)) || 1, 1), 114);
let pendingAyahSeek: { chapter: number; num: number; count: number } | null = null;

function quranReciterName(id: number): string {
  const r = quranReciters.find((x) => x.id === id);
  return r ? r.label || r.reciter_name : 'Quran';
}

function currentQuranReciterId(): number {
  return quranReciterId;
}

function quranReciterIndex(): number {
  return quranReciters.findIndex((r) => r.id === quranReciterId);
}

function buildQuranSong(ch: QuranChapter, reciterId: number): Song {
  const reciter = quranReciterName(reciterId);
  return {
    id: `quran:${reciterId}:${ch.id}`,
    title: `${ch.id}. ${ch.name_simple}`,
    channel: reciter,
    arabic: ch.name_arabic,
    kind: 'quran',
    reciter_id: reciterId,
    chapter_id: ch.id,
    verses_count: ch.verses_count,
  };
}

function quranSongs(): Song[] {
  const reciterId = currentQuranReciterId();
  return quranChapters.map((ch) => buildQuranSong(ch, reciterId));
}

function renderQuranList() {
  const filterRow = $('#quran-filter-row');
  if (quranLoaded && quranChapters.length) {
    filterRow.style.display = '';
  } else {
    filterRow.style.display = 'none';
    (quranFilterInput as HTMLInputElement).value = '';
    $('#quran-filter-clear').style.display = 'none';
  }
  const term = quranFilterInput.value.trim().toLowerCase();
  const songs = term
    ? quranSongs().filter((s) => {
        const ch = quranChapters.find((c) => c.id === s.chapter_id);
        return (
          String(s.chapter_id).includes(term) ||
          (!!ch &&
            (ch.name_simple.toLowerCase().includes(term) ||
              ch.name_arabic.includes(term) ||
              (ch.name_complex || '').toLowerCase().includes(term) ||
              (ch.translated_name?.name || '').toLowerCase().includes(term)))
        );
      })
    : quranSongs();
  if (!songs.length) {
    $('#quran-list').style.display = 'none';
    $('#quran-empty').style.display = term ? 'none' : '';
    $('#quran-actions').classList.add('hidden');
    $('#quran-subtitle').textContent = term ? t('quran.no_match', { q: term }) : t('quran.sub');
    return;
  }
  $('#quran-empty').style.display = 'none';
  $('#quran-list').style.display = '';
  $('#quran-actions').classList.remove('hidden');
  $('#quran-subtitle').textContent = t('quran.count_reciter', { n: songs.length, r: quranReciterName(quranReciterId) });
  renderList('quran-list', songs, 'quran');
}

function syncQuranReciterUI(scrollIntoView = false) {
  const scroller = $('#quran-reciter-scroller');
  const chips = Array.from(scroller.querySelectorAll<HTMLElement>('.quran-reciter-chip'));
  chips.forEach((chip) => {
    const on = Number(chip.dataset.id) === quranReciterId;
    chip.classList.toggle('active', on);
    chip.setAttribute('aria-selected', on ? 'true' : 'false');
  });
  const idx = quranReciterIndex();
  const pos = $('#quran-reciter-pos');
  if (quranReciters.length) {
    pos.textContent = `${idx >= 0 ? idx + 1 : 1} / ${quranReciters.length}`;
  } else {
    pos.textContent = '';
  }
  $('#quran-reciter-prev').toggleAttribute('disabled', idx <= 0);
  $('#quran-reciter-next').toggleAttribute('disabled', idx < 0 || idx >= quranReciters.length - 1);
  updateReciterEdgeBtns();
  if (scrollIntoView && idx >= 0 && chips[idx]) {
    chips[idx].scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  }
}

function updateReciterEdgeBtns() {
  const scroller = $('#quran-reciter-scroller');
  const max = scroller.scrollWidth - scroller.clientWidth;
  $('#quran-reciter-scroll-l').classList.toggle('show', scroller.scrollLeft > 4);
  $('#quran-reciter-scroll-r').classList.toggle('show', scroller.scrollLeft < max - 4 && max > 4);
}

function applyQuranReciter(id: number, scroll = true) {
  if (!quranReciters.some((r) => r.id === id)) return;
  const changed = quranReciterId !== id;
  quranReciterId = id;
  store('ns_qreciter', String(id));
  if (changed) {
    queue.forEach((s) => {
      if (s.kind === 'quran') {
        s.reciter_id = id;
        s.stream_url = undefined;
        s.id = `quran:${id}:${s.chapter_id}`;
      }
    });
    preShuffleQueue.forEach((s) => {
      if (s.kind === 'quran') {
        s.reciter_id = id;
        s.stream_url = undefined;
        s.id = `quran:${id}:${s.chapter_id}`;
      }
    });
    if (currentSong?.kind === 'quran') {
      currentSong.reciter_id = id;
      currentSong.channel = quranReciterName(id);
      currentSong.stream_url = undefined;
      currentSong.id = `quran:${id}:${currentSong.chapter_id}`;
      updatePlayer();
      pushDiscord(true);
    }
    renderQuranList();
  }
  syncQuranReciterUI(scroll);
}

function stepQuranReciter(delta: number) {
  if (!quranReciters.length) return;
  let i = quranReciterIndex();
  if (i < 0) i = 0;
  const next = Math.max(0, Math.min(quranReciters.length - 1, i + delta));
  applyQuranReciter(quranReciters[next].id, true);
}

// --- QURAN AYAH READER ---
let transLang = load<string>('ns_qtrans', 'en');
let transDataLang = transLang === 'off' ? 'en' : transLang;
const transCache = new Map<string, { name: string; verses: { num: number; arabic: string; text: string }[] }>();
let transLoadedKey = '';
let transAyahIdx = -1;

function transHint(text: string) {
  $('#quran-trans-body').innerHTML = `<div class="quran-trans-hint">${esc(text)}</div>`;
  $('#quran-trans-body').classList.remove('hide-tr');
  $('#quran-trans-src').textContent = '';
  $('#quran-ayah-pos').textContent = '';
  $('#ayah-prev').toggleAttribute('disabled', true);
  $('#ayah-next').toggleAttribute('disabled', true);
  renderQuranReadHead();
}

function seekToAyah(num: number) {
  const rows = $$('.quran-trans-body .quran-ayah');
  const n = rows.length;
  if (!n || !audio.duration || currentSong?.kind !== 'quran' || currentSong.chapter_id !== readChapterId) return;
  const target = Math.max(0, Math.min(num - 1, n - 1));
  audio.currentTime = ((target + 0.01) / n) * audio.duration;
  audio.play().catch(playError);
}

function playingReadChapter(): boolean {
  return (
    !!currentSong &&
    currentSong.kind === 'quran' &&
    currentSong.chapter_id === readChapterId &&
    !!audio.duration
  );
}

function readerChapter(): QuranChapter | undefined {
  return quranChapters.find((c) => c.id === readChapterId);
}

function startQuranFromAyah(chapterId: number, num: number, count: number) {
  const ch = quranChapters.find((c) => c.id === chapterId);
  if (!ch) return;
  const songs = quranSongs();
  const song = songs.find((s) => s.chapter_id === chapterId);
  if (!song) return;
  pendingAyahSeek = { chapter: chapterId, num, count };
  playSong(song, Math.max(0, songs.indexOf(song)), 'quran');
}

function onAyahClick(num: number, count: number) {
  if (playingReadChapter()) {
    seekToAyah(num);
  } else {
    startQuranFromAyah(readChapterId, num, count);
  }
}

function scrollToAyah(num: number) {
  const rows = $$('.quran-trans-body .quran-ayah');
  const n = rows.length;
  if (!n) return;
  const target = Math.max(0, Math.min(num - 1, n - 1));
  transAyahIdx = target;
  rows.forEach((r) => r.classList.remove('active'));
  rows[target].scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  $('#quran-ayah-pos').textContent = `${target + 1} / ${n}`;
  $('#ayah-prev').toggleAttribute('disabled', target <= 0);
  $('#ayah-next').toggleAttribute('disabled', target >= n - 1);
}

function setReadChapter(id: number) {
  if (!quranChapters.some((c) => c.id === id)) return;
  const changed = readChapterId !== id;
  readChapterId = id;
  store('ns_qread', String(id));
  if (changed) {
    transLoadedKey = '';
    transAyahIdx = -1;
    $('#quran-ayah-pos').textContent = '';
  }
  syncQuranTranslation();
}

function renderQuranReadHead() {
  const head = $('#quran-read-head');
  const ch = readerChapter();
  if (!quranChapters.length || !ch) {
    head.style.display = 'none';
    return;
  }
  head.style.display = '';
  $('#quran-read-num').textContent = String(ch.id);
  $('#quran-read-name').textContent = ch.name_simple;
  $('#quran-read-arabic').textContent = ch.name_arabic;
  const place = ch.revelation_place
    ? t(ch.revelation_place.toLowerCase() === 'makkah' ? 'quran.makkah' : 'quran.madinah')
    : '';
  const bits = [ch.translated_name?.name || ch.name_complex || '', place, t('quran.n_ayahs', { n: ch.verses_count })].filter(Boolean);
  $('#quran-read-meta').textContent = bits.join(' · ');
}

function showSurahPicker() {
  if (!quranChapters.length) return;
  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    m.close();
  };
  const content = document.createElement('div');
  content.className = 'modal-body reciter-picker';
  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'modal-input';
  input.placeholder = t('quran.search_surahs');
  input.spellcheck = false;
  const count = document.createElement('div');
  count.className = 'modal-hint reciter-picker-count';
  const list = document.createElement('div');
  list.className = 'modal-list reciter-picker-list';
  const render = (q: string) => {
    const term = q.trim().toLowerCase();
    const items = quranChapters.filter(
      (c) =>
        !term ||
        String(c.id).includes(term) ||
        c.name_simple.toLowerCase().includes(term) ||
        c.name_arabic.includes(term) ||
        (c.name_complex || '').toLowerCase().includes(term) ||
        (c.translated_name?.name || '').toLowerCase().includes(term)
    );
    list.innerHTML = '';
    if (!items.length) {
      const h = document.createElement('div');
      h.className = 'modal-hint';
      h.innerHTML = `<i class="fa-solid fa-magnifying-glass" style="margin-right:8px"></i>${esc(t('quran.no_surahs'))}`;
      list.appendChild(h);
    } else {
      items.forEach((c) => {
        const on = c.id === readChapterId;
        const opt = document.createElement('button');
        opt.type = 'button';
        opt.className = 'modal-opt reciter-opt' + (on ? ' active' : '');
        opt.innerHTML = `
          <i class="fa-solid ${on ? 'fa-check' : 'fa-book-quran'}"></i>
          <span class="reciter-opt-text">
            <span class="reciter-opt-name">${esc(String(c.id))}. ${esc(c.name_simple)}</span>
            ${c.translated_name?.name || c.verses_count ? `<span class="reciter-opt-style">${esc(c.translated_name?.name || '')}${c.translated_name?.name && c.verses_count ? ' · ' : ''}${c.verses_count ? `${esc(String(c.verses_count))} ayahs` : ''}</span>` : ''}
          </span>
          <span class="surah-opt-ar" dir="rtl">${esc(c.name_arabic)}</span>`;
        opt.addEventListener('click', () => {
          setReadChapter(c.id);
          finish();
        });
        list.appendChild(opt);
      });
    }
    count.textContent = term
      ? t('quran.count_of', { a: items.length, b: quranChapters.length })
      : t('quran.count', { n: quranChapters.length });
  };
  input.addEventListener('input', () => render(input.value));
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const first = list.querySelector<HTMLElement>('.reciter-opt');
      if (first) {
        e.preventDefault();
        first.click();
      }
    }
  });
  content.append(input, count, list);
  const m = new Modal(t('quran.pick'), content, () => finish(), 'modal-reciter');
  render('');
  window.setTimeout(() => input.focus(), 30);
}

function highlightTransAyah(scroll: boolean) {
  if (!currentSong || currentSong.kind !== 'quran' || currentSong.chapter_id !== readChapterId) return;
  const rows = $$('.quran-trans-body .quran-ayah');
  if (!rows.length) return;
  const dur = audio.duration || currentSong.duration || 0;
  if (!dur) return;
  let idx = Math.floor((audio.currentTime / dur) * rows.length);
  if (idx < 0) idx = 0;
  if (idx >= rows.length) idx = rows.length - 1;
  if (idx === transAyahIdx) return;
  transAyahIdx = idx;
  rows.forEach((r, i) => r.classList.toggle('active', i === idx));
  $('#quran-ayah-pos').textContent = `${idx + 1} / ${rows.length}`;
  $('#ayah-prev').toggleAttribute('disabled', idx <= 0);
  $('#ayah-next').toggleAttribute('disabled', idx >= rows.length - 1);
  if (scroll) rows[idx].scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}

function syncQuranTranslation() {
  $$('.quran-trans-lang').forEach((b) => b.classList.toggle('active', b.dataset.lang === transLang));
  renderQuranReadHead();
  const body = $('#quran-trans-body');
  if (currentSong?.kind === 'quran' && currentSong.chapter_id && readChapterId !== currentSong.chapter_id) {
    readChapterId = currentSong.chapter_id;
    store('ns_qread', String(readChapterId));
    transLoadedKey = '';
    transAyahIdx = -1;
  }
  const ch = readChapterId;
  if (!ch) {
    transLoadedKey = '';
    transAyahIdx = -1;
    transHint(t('quran.hint'));
    return;
  }
  const dataLang = transLang === 'off' ? transDataLang : transLang;
  body.classList.toggle('hide-tr', transLang === 'off');
  const key = `${ch}:${dataLang}`;
  if (key === transLoadedKey) return;
  transLoadedKey = key;
  transAyahIdx = -1;
  $('#quran-trans-src').textContent = '';
  $('#quran-ayah-pos').textContent = '';
  $('#ayah-prev').toggleAttribute('disabled', true);
  $('#ayah-next').toggleAttribute('disabled', true);
  body.innerHTML = `<div class="quran-trans-hint">${esc(t('quran.trans_loading'))}</div>`;
  const render = (data: { name: string; verses: { num: number; arabic: string; text: string }[] }) => {
    if (transLoadedKey !== key) return;
    if (!data.verses.length) {
      transLoadedKey = '';
      transHint(t('quran.trans_err'));
      return;
    }
    $('#quran-trans-src').textContent = transLang === 'off' ? t('quran.trans_off_arabic') : data.name;
    body.classList.toggle('hide-tr', transLang === 'off');
    body.innerHTML = '';
    if (ch !== 1 && ch !== 9) {
      const b = document.createElement('div');
      b.className = 'quran-bismillah';
      b.dir = 'rtl';
      b.innerHTML = '<span>بِسْمِ ٱللَّٰهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ</span>';
      body.appendChild(b);
    }
    data.verses.forEach((v) => {
      const row = document.createElement('div');
      row.className = 'quran-ayah';
      row.innerHTML = `
        <div class="quran-ayah-ar" dir="rtl">${esc(v.arabic)}<span class="quran-ayah-badge">${esc(String(v.num))}</span></div>
        <div class="quran-ayah-text">${esc(v.text)}</div>`;
      row.addEventListener('click', () => onAyahClick(v.num, data.verses.length));
      body.appendChild(row);
    });
    highlightTransAyah(true);
  };
  const cached = transCache.get(key);
  if (cached) {
    render(cached);
    return;
  }
  void (async () => {
    try {
      const r = await fetch(`${API}/api/quran/translation/${ch}?lang=${dataLang}`);
      if (!r.ok) throw new Error('trans');
      const d = (await r.json()) as { name?: string; verses?: { num: number; arabic: string; text: string }[] };
      const data = { name: d.name || '', verses: d.verses || [] };
      transCache.set(key, data);
      render(data);
    } catch {
      if (transLoadedKey === key) {
        transLoadedKey = '';
        transHint(t('quran.trans_err'));
      }
    }
  })();
}

$$<HTMLElement>('.quran-trans-lang').forEach((b) =>
  b.addEventListener('click', () => {
    transLang = b.dataset.lang || 'en';
    if (transLang !== 'off') transDataLang = transLang;
    store('ns_qtrans', transLang);
    transLoadedKey = '';
    syncQuranTranslation();
  })
);

$('#ayah-prev').addEventListener('click', () => {
  if (transAyahIdx > 0) {
    if (playingReadChapter()) seekToAyah(transAyahIdx);
    else scrollToAyah(transAyahIdx);
  }
});
$('#ayah-next').addEventListener('click', () => {
  const n = $$('.quran-trans-body .quran-ayah').length;
  if (transAyahIdx < n - 1) {
    if (playingReadChapter()) seekToAyah(transAyahIdx + 2);
    else scrollToAyah(transAyahIdx + 2);
  }
});

$('#quran-read-pick').addEventListener('click', () => showSurahPicker());

function jumpToAyah() {
  const el = $('#ayah-jump') as HTMLInputElement;
  const ch = readerChapter();
  if (!ch) return;
  const num = Math.floor(Number(el.value));
  el.value = '';
  if (!num || num < 1 || num > ch.verses_count) {
    toast(t('quran.surah_has', { n: ch.verses_count }));
    return;
  }
  if (playingReadChapter()) seekToAyah(num);
  else scrollToAyah(num);
}

$('#ayah-jump-go').addEventListener('click', jumpToAyah);
$('#ayah-jump').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    jumpToAyah();
  }
});

const quranFilterInput = $('#quran-filter') as HTMLInputElement;

quranFilterInput.addEventListener('input', () => {
  $('#quran-filter-clear').style.display = quranFilterInput.value ? '' : 'none';
  renderQuranList();
});
quranFilterInput.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    e.preventDefault();
    e.stopPropagation();
    quranFilterInput.value = '';
    $('#quran-filter-clear').style.display = 'none';
    renderQuranList();
    quranFilterInput.blur();
  }
});
$('#quran-filter-clear').addEventListener('click', () => {
  quranFilterInput.value = '';
  $('#quran-filter-clear').style.display = 'none';
  renderQuranList();
  quranFilterInput.focus();
});

function renderQuranReciterChips() {
  const scroller = $('#quran-reciter-scroller');
  scroller.innerHTML = '';
  quranReciters.forEach((r) => {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'quran-reciter-chip';
    chip.dataset.id = String(r.id);
    chip.setAttribute('role', 'option');
    chip.setAttribute('aria-selected', 'false');
    chip.innerHTML = `<i class="fa-solid fa-microphone-lines"></i><span>${esc(r.label || r.reciter_name)}</span>`;
    chip.addEventListener('click', () => applyQuranReciter(r.id, true));
    scroller.appendChild(chip);
  });
}

let quranRecitersPromise: Promise<void> | null = null;

async function loadQuranReciters() {
  if (quranReciters.length) {
    syncQuranReciterUI(false);
    return;
  }
  if (quranRecitersPromise) {
    await quranRecitersPromise;
    return;
  }
  quranRecitersPromise = (async () => {
    try {
      const r = await fetch(`${API}/api/quran/reciters`);
      if (!r.ok) throw new Error('reciters');
      const data = (await r.json()) as { recitations?: QuranReciter[] };
      quranReciters = data.recitations || [];
    } catch {
      quranReciters = [
        { id: Number(QURAN_DEFAULT_RECITER), reciter_name: 'Mishary Alafasi', label: 'Mishary Alafasi' },
      ];
    }
    const saved = Number(load<string>('ns_qreciter', QURAN_DEFAULT_RECITER));
    if (quranReciters.some((r) => r.id === saved)) {
      quranReciterId = saved;
    } else {
      const preferred =
        quranReciters.find((r) => r.id === Number(QURAN_DEFAULT_RECITER)) ||
        quranReciters.find((r) => /alafasi|alafasy|afasy|mishary/i.test(r.reciter_name)) ||
        quranReciters[0];
      quranReciterId = preferred ? preferred.id : Number(QURAN_DEFAULT_RECITER);
      store('ns_qreciter', String(quranReciterId));
    }
    renderQuranReciterChips();
    syncQuranReciterUI(true);
  })();
  try {
    await quranRecitersPromise;
  } finally {
    quranRecitersPromise = null;
  }
}

let quranLoadPromise: Promise<void> | null = null;

async function loadQuran() {
  if (quranLoadPromise) {
    await quranLoadPromise;
    return;
  }
  $('#quran-loading').style.display = '';
  $('#quran-list').style.display = 'none';
  $('#quran-empty').style.display = 'none';
  quranLoadPromise = (async () => {
    await loadQuranReciters();
    if (quranLoaded && quranChapters.length) {
      $('#quran-loading').style.display = 'none';
      renderQuranList();
      renderQuranReadHead();
      syncQuranTranslation();
      return;
    }
    try {
      const r = await fetch(`${API}/api/quran/chapters`);
      if (!r.ok) throw new Error('chapters');
      const data = (await r.json()) as { chapters?: QuranChapter[] };
      quranChapters = data.chapters || [];
      quranLoaded = true;
      $('#quran-loading').style.display = 'none';
      renderQuranList();
      renderQuranReadHead();
      syncQuranTranslation();
    } catch {
      $('#quran-loading').style.display = 'none';
      $('#quran-list').style.display = 'none';
      $('#quran-empty').style.display = '';
      $('#quran-actions').classList.add('hidden');
    }
  })();
  try {
    await quranLoadPromise;
  } finally {
    quranLoadPromise = null;
  }
}

$('#quran-reciter-prev').addEventListener('click', () => stepQuranReciter(-1));
$('#quran-reciter-next').addEventListener('click', () => stepQuranReciter(1));
$('#quran-reciter-browse').addEventListener('click', () => showReciterPicker());
$('#quran-reciter-scroll-l').addEventListener('click', () => {
  $('#quran-reciter-scroller').scrollBy({ left: -240, behavior: 'smooth' });
});
$('#quran-reciter-scroll-r').addEventListener('click', () => {
  $('#quran-reciter-scroller').scrollBy({ left: 240, behavior: 'smooth' });
});
$('#quran-reciter-scroller').addEventListener('scroll', updateReciterEdgeBtns, { passive: true });
window.addEventListener('resize', updateReciterEdgeBtns);
$('#quran-reciter-scroller').addEventListener('keydown', (e) => {
  if (e.key === 'ArrowRight') {
    e.preventDefault();
    stepQuranReciter(1);
  } else if (e.key === 'ArrowLeft') {
    e.preventDefault();
    stepQuranReciter(-1);
  } else if (e.key === 'Home') {
    e.preventDefault();
    if (quranReciters[0]) applyQuranReciter(quranReciters[0].id, true);
  } else if (e.key === 'End') {
    e.preventDefault();
    const last = quranReciters[quranReciters.length - 1];
    if (last) applyQuranReciter(last.id, true);
  }
});
$('#quran-reciter-scroller').addEventListener(
  'wheel',
  (e) => {
    const el = e.currentTarget as HTMLElement | null;
    if (!el) return;
    if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
      el.scrollLeft += e.deltaY;
      e.preventDefault();
    }
  },
  { passive: false }
);

$('#quran-retry').addEventListener('click', () => void loadQuran());
$('#quran-play').addEventListener('click', () => {
  const songs = quranSongs();
  if (!songs.length) return;
  const idx = shuffleOn ? Math.floor(Math.random() * songs.length) : 0;
  playSong(songs[idx], idx, 'quran');
});

$('#quran-shuffle').addEventListener('click', () => {
  const songs = quranSongs();
  if (!songs.length) return;
  if (!shuffleOn) setShuffle(true);
  const idx = Math.floor(Math.random() * songs.length);
  playSong(songs[idx], idx, 'quran');
});

// --- SEARCH ---
let searchTimer: number | undefined;

type RecentQ = { q: string; t: number };

const scRoot = $('#search-card');
const scCard = $('#sc-card');
const scBody = $('#sc-body');
const scList = $('#sc-list');
const scAction = $('#sc-action');
const scCloseBtn = $('#sc-close');
const scKbd = $('#sc-kbd');
const scInput = $('#search-input') as HTMLInputElement;

const SC_TRASH =
  '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 11v6"></path><path d="M14 11v6"></path><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"></path><path d="M3 6h18"></path><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>';
const SC_RESTORE =
  '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path><path d="M3 3v5h5"></path></svg>';

let scOpen = false;
let scItems: RecentQ[] = [];
let scCleared: RecentQ[] = [];
let scActiveId: string | null = null;
let scSheetShown = false;

function scLoadRecents(): RecentQ[] {
  const raw = load<unknown>('ns_recentq', []);
  if (!Array.isArray(raw)) return [];
  return raw
    .map((x): RecentQ =>
      typeof x === 'string'
        ? { q: x, t: 0 }
        : { q: String((x as RecentQ).q || ''), t: Number((x as RecentQ).t) || 0 }
    )
    .filter((x) => x.q);
}

function saveRecentQ(q: string) {
  const list = scLoadRecents().filter((x) => x.q !== q);
  list.unshift({ q, t: Date.now() });
  store('ns_recentq', list.slice(0, 8));
}

function scAgo(ts: number): string {
  if (!ts) return t('search.recent_one');
  const d = Date.now() - ts;
  if (d < 60000) return t('time.just_now');
  if (d < 3600000) return t('time.min_ago', { n: Math.max(1, Math.floor(d / 60000)) });
  if (d < 86400000) return t('time.hr_ago', { n: Math.floor(d / 3600000) });
  if (d < 172800000) return t('time.yesterday');
  return t('time.days_ago', { n: Math.floor(d / 86400000) });
}

function scTile(q: string): string {
  const ch = (q.trim().charAt(0) || '#').toUpperCase();
  return (
    '<div class="psearch__tile"><div class="psearch__tile-art">' +
    `<span class="psearch__tile-letter">${esc(ch)}</span></div></div>`
  );
}

function scSyncAction() {
  scAction.classList.toggle('hidden', !scItems.length && !scCleared.length);
  if (scItems.length) {
    scAction.textContent = t('search.clear_all');
    scAction.setAttribute('aria-label', 'Clear all recent searches');
  } else {
    scAction.innerHTML = `${SC_RESTORE} ${esc(t('sc.restore'))}`;
    scAction.setAttribute('aria-label', t('sc.restore_aria'));
  }
}

function scApplyFilter() {
  const q = scInput.value.trim().toLowerCase();
  let n = 0;
  scList.querySelectorAll<HTMLElement>('.psearch__row').forEach((r) => {
    const hit = !q || (r.dataset.q || '').includes(q);
    r.classList.toggle('hidden', !hit);
    if (hit) n++;
  });
  const empty = scList.querySelector<HTMLElement>('.psearch__empty');
  if (empty) {
    empty.classList.toggle('hidden', n > 0);
    const d = empty.firstElementChild;
    if (d) d.textContent = scItems.length ? t('search.no_match', { q: scInput.value.trim() }) : t('search.no_recent');
  }
  scSyncBodyHeight();
}

function scRenderRows(animate: boolean) {
  const keep = scActiveId;
  scActiveId = null;
  scSheetShown = false;
  let html = '<div class="psearch__sheet" aria-hidden="true"></div>';
  scItems.forEach((it, i) => {
    const delay = animate ? ` style="animation-delay:${(0.1 + i * 0.045).toFixed(3)}s"` : ' style="animation:none"';
    html +=
      `<li class="psearch__row" data-id="${esc(it.q)}" data-q="${esc(it.q.toLowerCase())}">` +
      '<div class="psearch__divider"></div>' +
      `<div class="psearch__row-body"${delay}>` +
      scTile(it.q) +
      '<div class="psearch__row-text">' +
      `<div class="psearch__row-title">${esc(it.q)}</div>` +
      `<div class="psearch__row-sub">${esc(scAgo(it.t))}</div>` +
      '</div>' +
      '<div class="psearch__remove-slot">' +
      `<button type="button" class="psearch__remove" aria-label="${esc(t('row.remove_named', { q: it.q }))}">${SC_TRASH}` +
      `<span class="psearch__tip" role="tooltip">${esc(t('row.remove'))}<span class="psearch__tip-arrow"></span></span></button>` +
      '</div></div></li>';
  });
  html += '<li class="psearch__empty hidden"><div></div></li>';
  scList.innerHTML = html;
  scApplyFilter();
  scSyncAction();
  if (keep) {
    for (const r of Array.from(scList.querySelectorAll<HTMLElement>('.psearch__row'))) {
      if (r.dataset.id === keep && !r.classList.contains('hidden')) {
        scSetActive(r);
        break;
      }
    }
  }
  scSyncBodyHeight();
}

function scSheetShow(row: HTMLElement) {
  const s = scList.querySelector<HTMLElement>('.psearch__sheet');
  if (!s) return;
  const jump = !scSheetShown;
  if (jump) s.classList.add('psearch__sheet--jump');
  s.style.transform = `translateY(${row.offsetTop}px)`;
  s.style.height = row.offsetHeight + 'px';
  s.style.opacity = '1';
  if (jump) {
    scSheetShown = true;
    requestAnimationFrame(() => s.classList.remove('psearch__sheet--jump'));
  }
}

function scSheetHide() {
  scSheetShown = false;
  scActiveId = null;
  const s = scList.querySelector<HTMLElement>('.psearch__sheet');
  if (s) s.style.opacity = '0';
  scList.querySelectorAll<HTMLElement>('.psearch__row').forEach((r) => {
    r.classList.remove('psearch__row--active', 'psearch__row--no-div');
  });
}

function scSetActive(row: HTMLElement) {
  const id = row.dataset.id || '';
  if (scActiveId === id) return;
  scActiveId = id;
  scList.querySelectorAll<HTMLElement>('.psearch__row').forEach((r) => {
    const on = r === row;
    r.classList.toggle('psearch__row--active', on);
    r.classList.toggle('psearch__row--no-div', on || r.nextElementSibling === row);
  });
  scSheetShow(row);
}

function scBodyContentHeight(): number {
  let h = 0;
  for (const c of Array.from(scBody.children)) h += (c as HTMLElement).offsetHeight;
  return h;
}

function scSyncBodyHeight() {
  if (!scOpen) return;
  const cur = scBody.style.height;
  if (!cur || cur === 'auto') return;
  scBody.style.height = scBodyContentHeight() + 'px';
}

function scSetBody(open: boolean) {
  if (open) {
    scBody.style.height = scBodyContentHeight() + 'px';
    window.setTimeout(() => {
      if (scOpen) scBody.style.height = 'auto';
    }, 460);
  } else {
    scBody.style.height = scBodyContentHeight() + 'px';
    void scBody.offsetHeight;
    scBody.style.height = '0px';
  }
}

function scOpenCard() {
  if (scOpen) return;
  scOpen = true;
  scCard.classList.add('psearch__card--open');
  scRoot.classList.add('psearch--open');
  scInput.placeholder = t('search.hint');
  scRenderRows(true);
  scSetBody(true);
}

function scCloseCard() {
  const wasOpen = scOpen || scCard.classList.contains('psearch__card--open');
  scOpen = false;
  scCard.classList.remove('psearch__card--open');
  scRoot.classList.remove('psearch--open');
  scInput.placeholder = t('search.placeholder');
  scSheetHide();
  if (wasOpen) scSetBody(false);
  else scBody.style.height = '0px';
  const a = document.activeElement as HTMLElement | null;
  if (a && scRoot.contains(a)) a.blur();
}

function scPick(q: string) {
  if (!q) return;
  scInput.value = q;
  scApplyFilter();
  clearTimeout(searchTimer);
  scCloseCard();
  void doSearch(q);
}

function scRemove(q: string) {
  let row: HTMLElement | null = null;
  for (const r of Array.from(scList.querySelectorAll<HTMLElement>('.psearch__row'))) {
    if (r.dataset.id === q) {
      row = r;
      break;
    }
  }
  if (!row) return;
  scSheetHide();
  row.classList.add('psearch__row--leaving');
  row.style.height = row.offsetHeight + 'px';
  void row.offsetHeight;
  row.style.transition = 'height .32s cubic-bezier(.65,0,.35,1),opacity .16s ease';
  row.style.height = '0px';
  row.style.opacity = '0';
  window.setTimeout(() => {
    scItems = scItems.filter((x) => x.q !== q);
    store('ns_recentq', scItems);
    scRenderRows(false);
  }, 340);
}

function goSearchView() {
  if ($('nav .nav-item.active')?.dataset.view === 'search') return;
  $$<HTMLElement>('.nav-item').forEach((b) => b.classList.remove('active'));
  $('[data-view="search"]').classList.add('active');
  $$<HTMLElement>('.view').forEach((el) => el.classList.remove('active'));
  $('#search-view').classList.add('active');
}

scInput.addEventListener('focus', () => scOpenCard());

scCard.addEventListener('click', (e) => {
  if (scOpen) return;
  if ((e.target as HTMLElement).closest('input')) return;
  scInput.focus();
});

document.addEventListener('pointerdown', (e) => {
  if (!scOpen) return;
  const t = e.target as Element | null;
  if (t && scRoot.contains(t)) return;
  scCloseCard();
});

window.addEventListener('keydown', (e) => {
  if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== 'k') return;
  e.preventDefault();
  if (scOpen) scCloseCard();
  else {
    goSearchView();
    scInput.focus();
  }
});

scList.addEventListener('pointerover', (e) => {
  const row = (e.target as HTMLElement).closest<HTMLElement>('.psearch__row');
  if (row && !row.classList.contains('hidden')) scSetActive(row);
});
scList.addEventListener('pointerleave', () => scSheetHide());
scList.addEventListener('focusin', (e) => {
  const row = (e.target as HTMLElement).closest<HTMLElement>('.psearch__row');
  if (row) scSetActive(row);
});

scList.addEventListener('click', (e) => {
  const t = e.target as HTMLElement;
  const row = t.closest<HTMLElement>('.psearch__row');
  if (!row) return;
  if (t.closest('.psearch__remove')) {
    e.stopPropagation();
    scRemove(row.dataset.id || '');
    return;
  }
  if (t.closest('.psearch__row-body')) scPick(row.dataset.id || '');
});

scAction.addEventListener('click', () => {
  if (scItems.length) {
    scCleared = scItems;
    scItems = [];
  } else {
    scItems = scCleared;
    scCleared = [];
    scInput.value = '';
  }
  store('ns_recentq', scItems);
  scRenderRows(true);
});

scInput.addEventListener('input', () => {
  scApplyFilter();
  clearTimeout(searchTimer);
  const q = scInput.value.trim();
  if (!q) {
    showEmpty();
    return;
  }
  searchTimer = window.setTimeout(() => doSearch(q), 350);
});
scInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    clearTimeout(searchTimer);
    const q = scInput.value.trim();
    if (q) doSearch(q);
  }
});
scRoot.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  if (scInput.value) {
    scInput.value = '';
    clearTimeout(searchTimer);
    showEmpty();
    scApplyFilter();
    return;
  }
  scCloseCard();
});
function scDismiss() {
  if (scInput.value) {
    scInput.value = '';
    clearTimeout(searchTimer);
    showEmpty();
    scApplyFilter();
  }
  scCloseCard();
}

scCloseBtn.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  e.stopPropagation();
  scDismiss();
});
scCloseBtn.addEventListener('click', (e) => {
  e.preventDefault();
  e.stopPropagation();
  scDismiss();
});

let searchGen = 0;

async function doSearch(q: string) {
  const gen = ++searchGen;
  show('loading');
  $('#search-status').textContent = '';
  try {
    const data = await getJSON<Song[]>(`${API}/api/search?q=${encodeURIComponent(q)}`);
    if (gen !== searchGen) return;
    saveRecentQ(q);
    scItems = scLoadRecents();
    if (scOpen) scRenderRows(false);
    if (!data.length) {
      showEmpty('search.no_results');
      return;
    }
    queue = data;
    queueIdx = -1;
    renderList('search-results', data, 'search');
    show('results');
  } catch {
    if (gen === searchGen) showEmpty('search.failed');
  }
}

function showEmpty(msgKey?: string) {
  $('#search-loading').style.display = 'none';
  $('#search-results').style.display = 'none';
  $('#search-empty').style.display = '';
  const title = $('#search-empty').querySelector('.empty-title');
  if (title) title.textContent = msgKey ? t(msgKey) : t('search.empty_title');
}
function show(what: 'empty' | 'loading' | 'results') {
  $('#search-empty').style.display = what === 'empty' ? '' : 'none';
  $('#search-loading').style.display = what === 'loading' ? '' : 'none';
  $('#search-results').style.display = what === 'results' ? '' : 'none';
}

// --- RENDER ---
function renderList(containerId: string, songs: Song[], ctx: string) {
  const c = $(`#${containerId}`);
  c.innerHTML = '';
  currentList = songs;
  songs.forEach((s, i) => c.appendChild(makeRow(s, i, ctx)));
}

function thumbSrc(song: Song): string {
  const t = song.thumbnail || '';
  if (t.startsWith('/') || t.startsWith('https://') || t.startsWith('http://')) return esc(t);
  return '';
}

function makeRow(song: Song, idx: number, ctx: string): HTMLElement {
  const r = document.createElement('div');
  r.className = 'track-row';
  r.dataset.id = song.id;
  if (currentSong && currentSong.id === song.id) r.classList.add('playing');
  const isQuran = ctx === 'quran' || song.kind === 'quran';
  const isLocal = !!song.local;
  const isProvided = !!song.provided || song.id.startsWith('provided-');
  const canRemove = ctx !== 'search' && ctx !== 'provided' && !isQuran;
  const heart = song.favorite ? 'fa-solid fa-heart fav-on' : 'fa-regular fa-heart';
  const sub = isQuran
    ? `<span class="track-ar">${esc(song.arabic || '')}</span><span class="track-ayahs">${song.verses_count ? `${esc(String(song.verses_count))} ayahs` : ''}</span>`
    : esc(song.channel);

  if (isQuran) r.classList.add('quran-row');

  r.innerHTML = `
    ${isQuran
      ? `<div class="track-num">${esc(String(song.chapter_id ?? idx + 1))}</div>`
      : song.local && !song.thumbnail
        ? `<div class="track-thumb track-thumb-ph"><i class="fa-solid fa-music"></i></div>`
        : `<img class="track-thumb" src="${thumbSrc(song)}" loading="lazy" alt="">`}
    <div class="track-info">
      <div class="track-name">${esc(song.title)}</div>
      <div class="track-channel">${sub}</div>
    </div>
    ${song.duration_string ? `<span class="track-dur">${esc(song.duration_string)}</span>` : ''}
    <div class="track-actions">
      <button class="track-act play-act" title="${esc(t('row.play'))}"><i class="fa-solid fa-play"></i></button>
      ${isQuran ? `<button class="track-act read-act" title="${esc(t('row.read'))}"><i class="fa-solid fa-book-open"></i></button>` : ''}
      ${canRemove ? `<button class="track-act rem-act" title="${esc(t('row.remove'))}"><i class="fa-solid fa-trash"></i></button>` : ''}
      ${isQuran ? '' : `<button class="track-act fav-act" title="${esc(t('row.like'))}"><i class="${heart}"></i></button>
      <button class="track-act pl-act" title="${esc(t('row.add_pl'))}"><i class="fa-solid fa-plus"></i></button>
      ${isProvided ? `<a class="track-act provided-download-act" href="/api/provided/audio/${encodeURIComponent(song.id)}?download=1" download title="${esc(t('player.dl_mp3'))}" aria-label="${esc(t('player.dl_mp3'))}"><i class="fa-solid fa-download"></i></a>` : isLocal ? '' : `<button class="track-act dl-act" title="${esc(t('row.dl'))}"><i class="fa-solid fa-download"></i></button>`}
      ${isLocal || isProvided ? '' : `<button class="track-act yt-act" title="${esc(t('row.yt'))}"><i class="fa-brands fa-youtube"></i></button>`}
      <button class="track-act disc-act" title="${esc(t('row.disc_shown'))}"><i class="fa-solid fa-eye"></i></button>`}
    </div>`;

  const rowImg = r.querySelector<HTMLImageElement>('img.track-thumb');
  if (rowImg) {
    const hideImg = () => { rowImg.style.display = 'none'; };
    rowImg.addEventListener('error', hideImg);
    if (rowImg.complete && rowImg.naturalWidth === 0) hideImg();
  }

  if (window.matchMedia('(pointer: coarse)').matches) {
    r.addEventListener('click', (e) => {
      if ((e.target as HTMLElement).closest('.track-act')) return;
      playSong(song, idx, ctx);
    });
  } else {
    r.addEventListener('dblclick', () => playSong(song, idx, ctx));
  }
  let warmTimer: number | undefined;
  if (!isQuran) {
    r.addEventListener('mouseenter', () => {
      warmTimer = window.setTimeout(() => warm(song.id), 150);
    });
    r.addEventListener('mouseleave', () => clearTimeout(warmTimer));
  }
  r.querySelector('.play-act')!.addEventListener('click', (e) => { e.stopPropagation(); playSong(song, idx, ctx); });
  if (isQuran) {
    const readBtn = r.querySelector<HTMLElement>('.read-act');
    if (readBtn && song.chapter_id) {
      readBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        setReadChapter(song.chapter_id as number);
        $('#quran-trans').scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    }
  }
  if (!isQuran) {
    r.querySelector('.fav-act')!.addEventListener('click', (e) => { e.stopPropagation(); toggleFav(song); });
    r.querySelector('.pl-act')!.addEventListener('click', (e) => { e.stopPropagation(); addToPl(song); });
    const ytBtn = r.querySelector<HTMLElement>('.yt-act');
    if (ytBtn) {
      ytBtn.addEventListener('click', (e) => { e.stopPropagation(); seeOnYouTube(song); });
    }
    const dlBtn = r.querySelector<HTMLElement>('.dl-act');
    if (dlBtn && !isProvided) {
      dlBtnUi(dlBtn, song.id);
      dlBtn.addEventListener('click', (e) => { e.stopPropagation(); void dlAction(song); });
    }
    const discBtn = r.querySelector<HTMLElement>('.disc-act');
    if (discBtn) {
      const hidden = discIsHidden(song.id);
      const icon = discBtn.querySelector('i');
      if (icon) icon.className = hidden ? 'fa-solid fa-eye-slash' : 'fa-solid fa-eye';
      discBtn.classList.toggle('disc-hide', hidden);
      discBtn.title = hidden ? t('row.disc_hidden') : t('row.disc_shown');
      discBtn.addEventListener('click', (e) => { e.stopPropagation(); discToggleSong(song); });
    }
  }
  if (canRemove) {
    r.querySelector('.rem-act')!.addEventListener('click', (e) => { e.stopPropagation(); removeFromList(song); });
  }
  return r;
}

// --- PLAYBACK ---
const warmed = new Set<string>();

function warm(id: string) {
  if (id.startsWith('local-') || id.startsWith('provided-') || downloadedIds.has(id)) return;
  if (warmed.has(id)) return;
  warmed.add(id);
  fetch(`${API}/api/warm/${encodeURIComponent(id)}`).then((r) => {
    if (!r.ok) warmed.delete(id);
  }).catch(() => warmed.delete(id));
}

// --- DOWNLOADS ---
function dlBtnUi(btn: HTMLElement, id: string) {
  const active = dlActive.has(id);
  const done = downloadedIds.has(id);
  btn.classList.toggle('dl-active', active);
  btn.classList.toggle('dl-done', done);
  const i = btn.querySelector('i');
  if (i) {
    i.className = active
      ? 'fa-solid fa-arrows-rotate fa-spin'
      : done
        ? 'fa-solid fa-circle-check'
        : 'fa-solid fa-download';
  }
  btn.title = active ? t('player.dl_active') : done ? t('player.dl_done') : t('player.dl');
}

function refreshDl(id: string) {
  $$<HTMLElement>(`.track-row[data-id="${CSS.escape(id)}"] .dl-act`).forEach((b) => dlBtnUi(b, id));
  if (currentSong && currentSong.id === id) dlBtnUi($('#dl-btn'), id);
}

async function dlAction(song: Song) {
  if (song.provided || song.id.startsWith('provided-')) {
    const link = document.createElement('a');
    link.href = `${API}/api/provided/audio/${encodeURIComponent(song.id)}?download=1`;
    link.download = `${song.id.replace(/^provided-/, '')}.mp3`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    return;
  }
  if (song.kind === 'quran' || song.local) return;
  if (dlActive.has(song.id)) {
    await getJSON<{ ok: boolean }>(`${API}/api/download/remove`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: song.id }),
    }).catch(() => undefined);
    dlActive.delete(song.id);
    refreshDl(song.id);
    toast(t('dl.canceled'));
    return;
  }
  if (downloadedIds.has(song.id)) {
    const ok = await confirmDialog(t('dl.remove_title'), t('dl.remove_q', { t: song.title }));
    if (!ok) return;
    await getJSON<{ ok: boolean }>(`${API}/api/download/remove`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: song.id }),
    }).catch(() => undefined);
    downloadedIds.delete(song.id);
    if (currentSong && currentSong.id === song.id) currentSong.downloaded = false;
    refreshDl(song.id);
    toast(t('dl.removed'));
    return;
  }
  await getJSON<{ ok: boolean }>(`${API}/api/library/add`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(song),
  }).catch(() => undefined);
  const r = await getJSON<{ ok?: boolean; error?: string }>(`${API}/api/download`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: song.id }),
  }).catch(() => ({ error: 'failed' }) as { ok?: boolean; error?: string });
  if (r.error || r.ok === false) {
    toast(t('dl.start_fail'));
    return;
  }
  dlActive.add(song.id);
  refreshDl(song.id);
  toast(t('dl.starting', { t: song.title }));
  startDlPoll();
}

function startDlPoll() {
  if (dlPollTimer) return;
  dlPollTimer = window.setInterval(() => void pollDownloads(), 1000);
}

async function pollDownloads() {
  const d = await getJSON<{ downloads: Record<string, { state: string; progress: number; error?: string }> }>(
    `${API}/api/download/status`,
  ).catch(() => null);
  if (!d) return;
  let active = 0;
  for (const id of Object.keys(d.downloads || {})) {
    const st = d.downloads[id];
    if (st.state === 'downloading') {
      active++;
      if (!dlActive.has(id)) {
        dlActive.add(id);
        refreshDl(id);
      }
    } else if (st.state === 'done') {
      if (dlActive.has(id)) toast(t('dl.done'));
      dlActive.delete(id);
      downloadedIds.add(id);
      if (currentSong && currentSong.id === id) currentSong.downloaded = true;
      refreshDl(id);
    } else if (st.state === 'error') {
      if (dlActive.has(id)) toast(t('dl.failed') + (st.error ? `: ${st.error}` : ''));
      dlActive.delete(id);
      refreshDl(id);
    }
  }
  if (!active && dlPollTimer) {
    window.clearInterval(dlPollTimer);
    dlPollTimer = undefined;
  }
}

async function initDownloads() {
  try {
    const lib = await getJSON<Library>(`${API}/api/library`);
    (lib.songs || []).forEach((s) => {
      if (s.downloaded || s.local) downloadedIds.add(s.id);
    });
  } catch {}
  await pollDownloads();
  startDlPoll();
}

function syncIcons() {
  const paused = audio.paused;
  $('#buf-icon').classList.toggle('hidden', !buffering);
  $('#play-icon').classList.toggle('hidden', !paused || buffering);
  $('#pause-icon').classList.toggle('hidden', paused || buffering);
}

function setBuffering(on: boolean) {
  buffering = on;
  syncIcons();
}

function playError(e: unknown) {
  const name = (e as DOMException)?.name;
  if (name === 'AbortError') return;
  setBuffering(false);
  if (name === 'NotAllowedError') {
    toast(t('play.click_start'));
    return;
  }
  toast(t('play.fail'));
}

function songSrc(song: Song): string {
  if (song.kind === 'quran') {
    if (song.stream_url) return song.stream_url;
    const reciter = song.reciter_id ?? currentQuranReciterId();
    const chapter = song.chapter_id ?? 1;
    return `${API}/api/quran/chapter_audio/${reciter}/${chapter}`;
  }
  if (song.local) return `${API}/api/file/${encodeURIComponent(song.id)}`;
  if (song.provided || song.id.startsWith('provided-')) return `${API}/api/provided/audio/${encodeURIComponent(song.id)}`;
  return `${API}/api/proxy/${encodeURIComponent(song.id)}`;
}

async function ensureQuranSrc(song: Song): Promise<string> {
  if (song.kind !== 'quran') return songSrc(song);
  if (song.stream_url) return song.stream_url;
  const reciter = song.reciter_id ?? currentQuranReciterId();
  const chapter = song.chapter_id ?? 1;
  const r = await fetch(`${API}/api/quran/chapter_audio/${reciter}/${chapter}`);
  if (!r.ok) throw new Error('quran audio');
  const data = (await r.json()) as { url?: string };
  if (!data.url) throw new Error('quran audio');
  const nowReciter = song.reciter_id ?? currentQuranReciterId();
  if (nowReciter !== reciter) throw new Error('quran audio');
  song.stream_url = data.url;
  return data.url;
}

async function playSong(song: Song, idx: number, _ctx: string, keepQueue = false) {
  if (startingId === song.id && !audio.error) {
    audio.play().catch(playError);
    return;
  }
  currentSong = song;
  if (keepQueue) {
    queueIdx = idx;
  } else {
    const base = currentList.length ? currentList : queue.slice();
    if (shuffleOn && base.length > 1) {
      preShuffleQueue = base.slice();
      queue = [song, ...shuffleArr(base.filter((s) => s.id !== song.id))];
      queueIdx = 0;
    } else {
      queue = base;
      queueIdx = idx;
    }
  }
  if (song.kind !== 'quran') recordRecent(song);
  updatePlayer();
  pushDiscord(true);
  botLastRefresh = 0;
  reportEvent(discIsHidden(song.id) ? 'hidden' : 'start', song);
  $$('.track-row').forEach((r) => r.classList.toggle('playing', r.dataset.id === song.id));
  startingId = song.id;
  setBuffering(true);
  try {
    if (song.kind === 'quran') {
      const src = await ensureQuranSrc(song);
      if (currentSong?.id !== song.id) return;
      audio.src = src;
    } else {
      audio.src = songSrc(song);
    }
    audio.load();
    audio.play().catch(playError);
  } catch {
    startingId = null;
    setBuffering(false);
    toast(t('err.load_quran_audio'));
    return;
  }
  if (song.kind !== 'quran') {
    getJSON<{ ok: boolean }>(`${API}/api/library/add`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(song),
    });
  }
}

function updatePlayer() {
  if (!currentSong) return;
  $('#player-title').textContent = currentSong.title;
  $('#player-artist').textContent = currentSong.channel;
  const th = $('#player-thumb') as HTMLImageElement;
  const ph = $('#player-thumb-ph');
  const safeThumb = thumbSrc(currentSong);
  if (safeThumb) {
    th.src = safeThumb;
    th.style.display = 'block';
    ph.style.display = 'none';
  } else {
    th.removeAttribute('src');
    th.style.display = 'none';
    ph.style.display = '';
    const icon = ph.querySelector('i');
    if (icon) icon.className = currentSong.kind === 'quran' ? 'fa-solid fa-book-quran' : 'fa-solid fa-music';
  }
  $('#fav-btn i').className = currentSong.favorite ? 'fa-solid fa-heart fav-on' : 'fa-regular fa-heart';
  const isProvided = !!currentSong.provided || currentSong.id.startsWith('provided-');
  $('#yt-btn').classList.toggle('hidden', currentSong.kind === 'quran' || !!currentSong.local || isProvided);
  const dlBtn = $('#dl-btn');
  const canDownload = currentSong.kind !== 'quran' && !currentSong.local;
  dlBtn.classList.toggle('hidden', !canDownload);
  if (canDownload) {
    dlBtnUi(dlBtn, currentSong.id);
    if (isProvided) dlBtn.title = t('player.dl_mp3');
  }
  syncQuranTranslation();
  if ('mediaSession' in navigator) {
    navigator.mediaSession.metadata = new MediaMetadata({
      title: currentSong.title,
      artist: currentSong.channel,
      album: currentSong.kind === 'quran' ? 'Quran' : 'Quran',
      artwork: safeThumb ? [{ src: safeThumb, sizes: '512x512', type: 'image/jpeg' }] : [],
    });
  }
}

// --- CONTROLS ---
$('#yt-btn').addEventListener('click', () => {
  if (!currentSong || currentSong.kind === 'quran' || currentSong.local || currentSong.provided || currentSong.id.startsWith('provided-')) return;
  seeOnYouTube(currentSong);
});
$('#dl-btn').addEventListener('click', () => {
  if (!currentSong || currentSong.kind === 'quran' || currentSong.local) return;
  void dlAction(currentSong);
});
$('#fav-btn').addEventListener('click', () => {
  if (!currentSong) return;
  if (currentSong.kind === 'quran') {
    toast(t('fav.denied_quran'));
    return;
  }
  void toggleFav(currentSong);
});
$('#play-btn').addEventListener('click', () => {
  if (audio.paused && audio.src) {
    audio.play().catch(playError);
  } else if (!audio.paused) {
    audio.pause();
  }
});
$('#stop-btn').addEventListener('click', () => {
  audio.pause();
  audio.currentTime = 0;
  resetPlayer();
});
$('#prev-btn').addEventListener('click', () => {
  if (!queue.length) return;
  if (queueIdx > 0) {
    playSong(queue[queueIdx - 1], queueIdx - 1, 'search', true);
  } else {
    queueIdx = queue.length - 1;
    playSong(queue[queueIdx], queueIdx, 'search', true);
  }
});
$('#next-btn').addEventListener('click', nextTrack);

$('#shuffle-btn').addEventListener('click', () => {
  setShuffle(!shuffleOn);
  toast(shuffleOn ? 'Shuffle on' : 'Shuffle off');
});

function setShuffle(on: boolean) {
  shuffleOn = on;
  store('ns_shuffle', on);
  const btn = $('#shuffle-btn');
  btn.classList.toggle('active', on);
  btn.title = on ? t('player.shuffle') : t('player.shuffle');
  const cur = currentSong;
  if (!cur || !queue.length) return;
  if (on) {
    preShuffleQueue = queue.slice();
    queue = [...queue.slice(0, queueIdx + 1), ...shuffleArr(queue.slice(queueIdx + 1))];
  } else if (preShuffleQueue.length) {
    queue = preShuffleQueue;
    const i = queue.findIndex((s) => s.id === cur.id);
    if (i >= 0) queueIdx = i;
    preShuffleQueue = [];
  }
}

$('#loop-btn').addEventListener('click', () => {
  loopMode = loopMode === 'off' ? 'one' : 'off';
  store('ns_loop', loopMode);
  const btn = $('#loop-btn');
  btn.classList.toggle('active', loopMode !== 'off');
  btn.title = t('player.loop');
  toast(loopMode === 'one' ? 'Loop on' : 'Loop off');
});

function nextTrack() {
  if (!queue.length) return;
  if (queueIdx < queue.length - 1) {
    playSong(queue[queueIdx + 1], queueIdx + 1, 'search', true);
  } else {
    resetPlayer();
  }
}

audio.addEventListener('ended', () => {
  if (loopMode === 'one' && currentSong) {
    const cur = currentSong;
    audio.currentTime = 0;
    audio.play().catch(() => playSong(cur, queueIdx, 'search', true));
  } else if (queueIdx < queue.length - 1) {
    playSong(queue[queueIdx + 1], queueIdx + 1, 'search', true);
  } else {
    resetPlayer();
  }
});

audio.addEventListener('play', () => {
  syncIcons();
  dcLastRefresh = 0;
  pushDiscord(true);
  botLastRefresh = 0;
  reportEvent('resume');
});
audio.addEventListener('loadedmetadata', () => {
  if (pendingAyahSeek && currentSong?.kind === 'quran' && currentSong.chapter_id === pendingAyahSeek.chapter && audio.duration) {
    const { num, count } = pendingAyahSeek;
    pendingAyahSeek = null;
    audio.currentTime = ((num - 1 + 0.01) / Math.max(count, num)) * audio.duration;
  }
  if (!audio.paused) {
    dcLastRefresh = 0;
    pushDiscord(true);
  }
});
audio.addEventListener('pause', () => {
  startingId = null;
  setBuffering(false);
  if (discordEnabled) dcPause();
  reportEvent('pause');
});
audio.addEventListener('playing', () => {
  startingId = null;
  setBuffering(false);
});
audio.addEventListener('waiting', () => setBuffering(true));
audio.addEventListener('error', () => {
  startingId = null;
  setBuffering(false);
  if (audio.src) toast(currentSong?.kind === 'quran' ? 'Could not load Quran audio' : 'Could not load nasheed');
});

function resetPlayer() {
  currentSong = null;
  queueIdx = -1;
  startingId = null;
  pendingAyahSeek = null;
  setBuffering(false);
  $('#player-title').textContent = t('player.idle');
  $('#player-artist').textContent = '';
  $('#player-thumb').style.display = 'none';
  $('#player-thumb-ph').style.display = 'flex';
  $('#fav-btn i').className = 'fa-regular fa-heart';
  $('#yt-btn').classList.add('hidden');
  seek.setValue(0);
  $('#time-pos').textContent = '0:00';
  $('#time-dur').textContent = '0:00';
  $$('.track-row').forEach((r) => r.classList.remove('playing'));
  audio.removeAttribute('src');
  syncQuranTranslation();
  dcLastRefresh = 0;
  if (discordEnabled) dcClear();
  reportEvent('stop');
  if ('mediaSession' in navigator) navigator.mediaSession.metadata = null;
}

// --- KEYBOARD SHORTCUTS ---
document.addEventListener('keydown', (e) => {
  if (e.defaultPrevented) return;
  if (e.target instanceof HTMLElement && e.target.tagName === 'INPUT') return;
  if (e.code === 'Space') {
    e.preventDefault();
    $('#play-btn').click();
  } else if (e.code === 'ArrowRight' && e.shiftKey) {
    e.preventDefault();
    $('#next-btn').click();
  } else if (e.code === 'ArrowLeft' && e.shiftKey) {
    e.preventDefault();
    $('#prev-btn').click();
  } else if (e.code === 'ArrowRight') {
    e.preventDefault();
    if (audio.duration) audio.currentTime = Math.min(audio.duration, audio.currentTime + 5);
  } else if (e.code === 'ArrowLeft') {
    e.preventDefault();
    audio.currentTime = Math.max(0, audio.currentTime - 5);
  } else if (e.code === 'ArrowUp') {
    e.preventDefault();
    audio.volume = Math.min(1, audio.volume + 0.05);
    vol.setValue(audio.volume * 100);
    updateVolIcon();
  } else if (e.code === 'ArrowDown') {
    e.preventDefault();
    audio.volume = Math.max(0, audio.volume - 0.05);
    vol.setValue(audio.volume * 100);
    updateVolIcon();
  } else if (e.key === 'l' || e.key === 'L') {
    $('#loop-btn').click();
  } else if (e.key === 'm' || e.key === 'M') {
    $('#vol-btn').click();
  } else if (e.key === '/' || e.key === 's') {
    e.preventDefault();
    goSearchView();
    scInput.focus();
  }
});

// --- PROGRESS ---
seek.onInput = (p) => {
  progressDrag = true;
  if (audio.duration) audio.currentTime = (p / 100) * audio.duration;
};
seek.onChange = () => {
  progressDrag = false;
  dcLastRefresh = 0;
  pushDiscord(true);
  botLastRefresh = 0;
  reportEvent('progress');
};

const seekTip = document.createElement('div');
seekTip.className = 'seek-tip';
$seekOrigin.appendChild(seekTip);
$seekOrigin.addEventListener('mousemove', (e) => {
  if (!audio.duration) {
    seekTip.classList.remove('show');
    return;
  }
  const rect = $seekOrigin.getBoundingClientRect();
  const pct = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
  seekTip.textContent = fmt(pct * audio.duration);
  seekTip.style.left = pct * 100 + '%';
  seekTip.classList.add('show');
});
$seekOrigin.addEventListener('mouseleave', () => seekTip.classList.remove('show'));

setInterval(() => {
  if (!audio.duration || progressDrag) return;
  const p = (audio.currentTime / audio.duration) * 100;
  seek.setValue(p);
  $('#time-pos').textContent = fmt(audio.currentTime);
  $('#time-dur').textContent = fmt(audio.duration);
  highlightTransAyah(true);
  pushDiscord();
  pushBot();
}, 250);

// --- VOLUME ---
const savedVolRaw = load<number>('ns_vol', 70);
const savedVol = typeof savedVolRaw === 'number' && isFinite(savedVolRaw) ? Math.min(100, Math.max(0, savedVolRaw)) : 70;
if (savedVol !== savedVolRaw) store('ns_vol', savedVol);
vol.setValue(savedVol);
audio.volume = savedVol / 100;
vol.onInput = (p) => {
  audio.volume = p / 100;
  store('ns_vol', Math.round(p));
  updateVolIcon();
  syncSettingsVol();
};
$('#vol-btn').addEventListener('click', () => {
  audio.muted = !audio.muted;
  updateVolIcon();
});

function updateVolIcon() {
  const i = $('#vol-btn i');
  if (audio.muted || audio.volume === 0) i.className = 'fa-solid fa-volume-xmark';
  else if (audio.volume < 0.3) i.className = 'fa-solid fa-volume-off';
  else if (audio.volume < 0.7) i.className = 'fa-solid fa-volume-low';
  else i.className = 'fa-solid fa-volume-high';
}

// --- LIBRARY ---
function applyLibSort(src: Song[]): Song[] {
  const s = src.slice();
  if (sortMode === 'title') s.sort((a, b) => a.title.localeCompare(b.title));
  else if (sortMode === 'channel') s.sort((a, b) => a.channel.localeCompare(b.channel));
  return s;
}

function syncSortUI() {
  $('#lib-sort-label').textContent = t('sort.' + sortMode);
  $$('.lib-sort-opt').forEach((o) => o.classList.toggle('active', o.dataset.sort === sortMode));
}

async function loadProvided(force = false) {
  $('#provided-list').style.display = 'none';
  $('#provided-empty').style.display = 'none';
  $('#provided-loading').style.display = '';
  $('#provided-subtitle').textContent = t('provided.sub');
  try {
    const response = await fetch(`${API}/api/provided${force ? '?refresh=1' : ''}`);
    if (!response.ok) throw new Error('catalog unavailable');
    const songs = await response.json() as Song[];
    $('#provided-loading').style.display = 'none';
    $('#provided-subtitle').textContent = t('provided.count', { n: songs.length, s: songs.length === 1 ? '' : 's' });
    if (!songs.length) {
      $('#provided-empty-title').textContent = t('provided.empty_title');
      $('#provided-empty-sub').textContent = t('provided.empty_sub');
      $('#provided-empty').style.display = '';
      return;
    }
    renderList('provided-list', songs, 'provided');
    $('#provided-list').style.display = '';
  } catch {
    $('#provided-loading').style.display = 'none';
    $('#provided-empty-title').textContent = t('provided.err_title');
    $('#provided-empty-sub').textContent = t('provided.err_sub');
    $('#provided-empty').style.display = '';
  }
}

$('#provided-refresh').addEventListener('click', () => void loadProvided(true));

async function loadLib(mode: string | undefined) {
  const lib = await getJSON<Library>(`${API}/api/library`);
  let songs: Song[] = [];
  let title = t('nav.library');
  let isPlaylist = false;
  if (mode === 'all' || mode === 'library') {
    songs = [...(lib.songs || [])].reverse();
    title = t('nav.library');
  } else if (mode === 'favorites') {
    songs = (lib.songs || []).filter((s) => s.favorite).reverse();
    title = t('nav.favorites');
  } else if (mode === 'downloads') {
    songs = (lib.songs || []).filter((s) => s.downloaded).reverse();
    title = t('nav.downloads');
  } else if (mode === 'local') {
    songs = (lib.songs || []).filter((s) => s.local).reverse();
    title = t('nav.local');
  } else if (mode === 'recent') {
    const stored = load<Song[]>('ns_recent', []);
    songs = stored.map((r) => {
      const inLib = (lib.songs || []).find((s) => s.id === r.id);
      return { ...r, favorite: inLib ? inLib.favorite : false };
    });
    title = t('nav.recent');
  } else if (mode && mode.startsWith('playlist:')) {
    const n = mode.slice('playlist:'.length);
    const pl = (lib.playlists || []).find((p) => p.name === n);
    songs = pl ? pl.songs : [];
    title = n;
    currentPlaylistName = n;
    isPlaylist = true;
  }
  if (!isPlaylist) currentPlaylistName = null;
  currentLibMode = mode;
  currentLibSource = songs;
  $('#lib-del').classList.toggle('hidden', !isPlaylist);
  $('#lib-rename').classList.toggle('hidden', !isPlaylist);
  $('#local-add').classList.toggle('hidden', mode !== 'local');
  $('#lib-title').textContent = title;
  $('#lib-subtitle').textContent = t('lib.count', { n: songs.length, s: songs.length !== 1 ? 's' : '' });
  $('#lib-actions').classList.toggle('hidden', !songs.length);
  const emptyKeys: Record<string, [string, string]> = {
    downloads: ['lib.empty_downloads_title', 'lib.empty_downloads_sub'],
    local: ['lib.empty_local_title', 'lib.empty_local_sub'],
  };
  const [titleKey, subKey] = emptyKeys[mode ?? ''] ?? ['lib.empty_title', 'lib.empty_sub'];
  const et = $('#lib-empty').querySelector('.empty-title');
  if (et) et.textContent = t(titleKey);
  const es = $('#lib-empty').querySelector('.empty-sub');
  if (es) es.textContent = t(subKey);
  if (!songs.length) {
    $('#lib-list').style.display = 'none';
    $('#lib-empty').style.display = '';
  } else {
    renderList('lib-list', applyLibSort(songs), 'library');
    $('#lib-empty').style.display = 'none';
    $('#lib-list').style.display = '';
  }
}

async function addLocalFiles(files: File[]) {
  let added = 0;
  for (const f of files) {
    const fd = new FormData();
    fd.append('file', f, f.name);
    let fail = '';
    try {
      const resp = await fetch(`${API}/api/local`, { method: 'POST', body: fd });
      if (resp.ok) {
        const r = (await resp.json()) as { ok?: boolean; error?: string };
        if (r.ok) {
          added++;
          continue;
        }
        fail = r.error || 'upload rejected';
      } else if (resp.status === 404) {
        fail = 'backend is out of date, restart the app';
      } else {
        try {
          const body = (await resp.json()) as { error?: string };
          fail = body.error || '';
        } catch {}
        if (!fail) fail = `server error (HTTP ${resp.status})`;
      }
    } catch {
      fail = "can't reach the backend";
    }
    toast(t('local.add_fail', { f: f.name, e: fail }));
  }
  if (added) {
    toast(added === 1 ? 'Added to Your Nasheeds' : `Added ${added} nasheeds to Your Nasheeds`);
    loadLib('local');
  }
}

$('#local-add').addEventListener('click', () => $('#local-file').click());
$('#local-file').addEventListener('change', () => {
  const input = $('#local-file') as HTMLInputElement;
  const files = Array.from(input.files || []);
  input.value = '';
  if (files.length) void addLocalFiles(files);
});

async function removeFromList(song: Song) {
  if (currentPlaylistName && currentLibMode && currentLibMode.startsWith('playlist:')) {
    const plName = currentPlaylistName;
    const ok = await confirmDialog(t('pl.remove_title'), t('pl.remove_q', { t: song.title, p: plName }));
    if (!ok) return;
    await getJSON<{ ok: boolean }>(`${API}/api/playlists/${encodeURIComponent(plName)}/remove/${encodeURIComponent(song.id)}`, { method: 'POST' });
    toast(t('pl.removed', { p: plName }));
    loadLib('playlist:' + plName);
  } else {
    const ok = await confirmDialog(t('pl.remove_lib_title'), t('pl.remove_lib_q', { t: song.title }));
    if (!ok) return;
    await getJSON<{ ok: boolean }>(`${API}/api/library/remove/${encodeURIComponent(song.id)}`, { method: 'POST' });
    downloadedIds.delete(song.id);
    dlActive.delete(song.id);
    if (currentSong && currentSong.id === song.id) currentSong.downloaded = false;
    toast(t('pl.removed_lib'));
    loadLib(currentLibMode ?? 'library');
  }
}

async function toggleFav(song: Song) {
  if (song.kind === 'quran') {
    toast(t('fav.denied_quran'));
    return;
  }
  try {
    await getJSON<{ ok: boolean }>(`${API}/api/library/add`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(song),
    });
    const d = await getJSON<{ favorite: boolean }>(`${API}/api/library/fav/${encodeURIComponent(song.id)}`, { method: 'POST' });
    $$<HTMLElement>(`.track-row[data-id="${CSS.escape(song.id)}"] .fav-act i`).forEach((i) => {
      i.className = d.favorite ? 'fa-solid fa-heart fav-on' : 'fa-regular fa-heart';
    });
    if (currentSong && currentSong.id === song.id) {
      currentSong.favorite = d.favorite;
      $('#fav-btn i').className = d.favorite ? 'fa-solid fa-heart fav-on' : 'fa-regular fa-heart';
    }
    toast(d.favorite ? t('fav.liked') : t('fav.unliked'));
  } catch {
    toast(t('fav.failed'));
  }
}

async function addToPl(song: Song) {
  await getJSON<{ ok: boolean }>(`${API}/api/library/add`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(song),
  });
  const name = await showPlaylistPicker();
  if (!name) return;
  await getJSON<{ ok: boolean }>(`${API}/api/playlists/${encodeURIComponent(name)}/add`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(song),
  });
  loadPlaylists();
  toast(t('pl.added', { p: name }));
}

function seeOnYouTube(song: Song) {
  if (song.provided || song.id.startsWith('provided-')) return;
  fetch(`${API}/api/open`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: `https://www.youtube.com/watch?v=${encodeURIComponent(song.id)}` }),
  }).then((r) => {
    if (!r.ok) toast(t('err.open_youtube'));
  }).catch(() => toast(t('err.open_youtube')));
}

// --- PLAYLISTS ---
async function deletePlaylist(name: string): Promise<boolean> {
  try {
    const d = await getJSON<{ ok?: boolean }>(`${API}/api/playlists/delete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    return !!d.ok;
  } catch {
    return false;
  }
}

function activateLibraryNav() {
  $$<HTMLElement>('.nav-item').forEach((n) => n.classList.remove('active'));
  $$<HTMLElement>('.nav-item').find((n) => n.dataset.view === 'library')?.classList.add('active');
  $$('.view').forEach((v) => v.classList.remove('active'));
  $('#library-view').classList.add('active');
}

function gotoLibrary() {
  activateLibraryNav();
  loadLib('library');
}

async function loadPlaylists() {
  const pls = await getJSON<Playlist[]>(`${API}/api/playlists`);
  const nav = $('#playlist-nav');
  nav.innerHTML = '';
  pls.forEach((pl) => {
    const row = document.createElement('div');
    row.className = 'pl-item-row';
    const b = document.createElement('button');
    b.className = 'pl-item';
    b.innerHTML = `<i class="fa-solid fa-list-ul"></i><span>${esc(pl.name)}</span>`;
    b.addEventListener('click', () => {
      activateLibraryNav();
      loadLib('playlist:' + pl.name);
    });
    const del = document.createElement('button');
    del.className = 'pl-del';
    del.title = t('lib.delete');
    del.innerHTML = '<i class="fa-solid fa-trash"></i>';
    del.addEventListener('click', async (e) => {
      e.stopPropagation();
      const ok = await confirmDialog(t('pl.delete_title'), t('pl.delete_q', { p: pl.name }));
      if (!ok) return;
      if (!(await deletePlaylist(pl.name))) {
        toast(t('pl.delete_fail'));
        return;
      }
      loadPlaylists();
      toast(t('pl.deleted', { p: pl.name }));
      if (currentPlaylistName === pl.name && $('#library-view').classList.contains('active')) gotoLibrary();
    });
    row.append(b, del);
    nav.appendChild(row);
  });
}

$('#lib-del').addEventListener('click', async () => {
  const name = currentPlaylistName;
  if (!name) return;
  const ok = await confirmDialog(t('pl.delete_title'), t('pl.delete_q', { p: name }));
  if (!ok) return;
  if (!(await deletePlaylist(name))) {
    toast(t('pl.delete_fail'));
    return;
  }
  currentPlaylistName = null;
  loadPlaylists();
  toast(t('pl.deleted', { p: name }));
  gotoLibrary();
});

$('#lib-rename').addEventListener('click', async () => {
  const oldName = currentPlaylistName;
  if (!oldName) return;
  const newName = await promptText(t('pl.rename'), t('pl.new_ph'), t('modal.rename_ok'), oldName);
  if (!newName || newName === oldName) return;
  let d: { ok?: boolean; error?: string };
  try {
    d = await getJSON<{ ok?: boolean; error?: string }>(`${API}/api/playlists/rename`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ old: oldName, new: newName }),
    });
  } catch (e) {
    d = {
      ok: false,
      error: ((e as { body?: { error?: string } }).body as { error?: string } | null)?.error,
    };
  }
  if (!d.ok) {
    toast(d.error === 'exists' ? 'A playlist with that name already exists' : 'Could not rename playlist');
    return;
  }
  loadPlaylists();
  toast(t('pl.rename_done', { p: newName }));
  loadLib('playlist:' + newName);
});

$('#pl-play').addEventListener('click', () => {
  if (!currentList.length) return;
  const idx = shuffleOn ? Math.floor(Math.random() * currentList.length) : 0;
  playSong(currentList[idx], idx, 'library');
});

$('#shuffle-play-btn').addEventListener('click', () => {
  if (!currentList.length) return;
  if (!shuffleOn) setShuffle(true);
  const idx = Math.floor(Math.random() * currentList.length);
  playSong(currentList[idx], idx, 'library');
});

$('#lib-sort-btn').addEventListener('click', (e) => {
  e.stopPropagation();
  $('#lib-sort-menu').classList.toggle('hidden');
});
$$('.lib-sort-opt').forEach((b) =>
  b.addEventListener('click', () => {
    sortMode = (b.dataset.sort as SortMode) || 'added';
    store('ns_sort', sortMode);
    syncSortUI();
    $('#lib-sort-menu').classList.add('hidden');
    if (currentLibSource.length && $('#library-view').classList.contains('active')) {
      renderList('lib-list', applyLibSort(currentLibSource), 'library');
    }
  })
);
document.addEventListener('click', (e) => {
  if (!(e.target as HTMLElement).closest('#lib-sort')) $('#lib-sort-menu').classList.add('hidden');
});

$('#add-pl-btn').addEventListener('click', async () => {
  const name = await promptText(t('pl.new'), t('pl.new_ph'), t('modal.create'));
  if (!name) return;
  await getJSON<{ ok: boolean }>(`${API}/api/playlists/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });
  loadPlaylists();
  toast(t('pl.created', { p: name }));
});

// --- DISCORD PRESENCE ---
let discordEnabled = load<boolean>('ns_discord', false);
let discTouched = false;
let dcLastRefresh = 0;

function discHiddenIds(): string[] {
  return load<string[]>('ns_discord_hidden', []);
}
function discIsHidden(id: string): boolean {
  return discHiddenIds().includes(id);
}
function discPushHidden() {
  void getJSON<{ ok?: boolean }>(`${API}/api/discord/hidden`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ids: discHiddenIds() }),
  }).catch(() => undefined);
}
function discSetHidden(id: string, hidden: boolean) {
  const set = discHiddenIds().filter((x) => x !== id);
  if (hidden) set.push(id);
  store('ns_discord_hidden', set);
  discTouched = true;
  discPushHidden();
}
function syncDiscBtns(id: string) {
  const hidden = discIsHidden(id);
  $$<HTMLElement>(`.track-row[data-id="${CSS.escape(id)}"] .disc-act`).forEach((b) => {
    const icon = b.querySelector('i');
    if (icon) icon.className = hidden ? 'fa-solid fa-eye-slash' : 'fa-solid fa-eye';
    b.classList.toggle('disc-hide', hidden);
    b.title = hidden ? t('row.disc_hidden') : t('row.disc_shown');
  });
}
function syncAllDiscBtns() {
  $$<HTMLElement>('.track-row[data-id]').forEach((r) => {
    if (r.dataset.id) syncDiscBtns(r.dataset.id);
  });
}
function discToggleSong(song: Song) {
  const hidden = !discIsHidden(song.id);
  discSetHidden(song.id, hidden);
  syncDiscBtns(song.id);
  toast(hidden ? t('row.disc_hidden') : t('row.disc_shown'));
  if (currentSong && currentSong.id === song.id) {
    pushDiscord(true);
    reportEvent(hidden ? 'hidden' : 'resume');
  }
}

function setDiscordStatus(state: 'off' | 'connecting' | 'connected' | 'not-running' | 'error') {
  const el = $('#set-discord-status');
  if (!el) return;
  el.classList.remove('ok', 'warn', 'err');
  if (state === 'connected') {
    el.textContent = t('set.dc_connected');
    el.classList.add('ok');
  } else if (state === 'connecting') {
    el.textContent = t('set.dc_connecting');
    el.classList.add('warn');
  } else if (state === 'not-running') {
    el.textContent = t('set.dc_not_running');
    el.classList.add('warn');
  } else if (state === 'error') {
    el.textContent = t('set.dc_err');
    el.classList.add('err');
  } else {
    el.textContent = t('set.dc_off');
  }
}

function dcActivity(paused = false): Record<string, unknown> | null {
  if (!currentSong || discIsHidden(currentSong.id)) return null;
  const channel = currentSong.channel || '';
  const a: Record<string, unknown> = {
    details: currentSong.title,
    state: paused ? (channel ? 'Paused - ' + channel : 'Paused') : (channel || 'Quran'),
  };
  if (!paused) {
    const start = Date.now() - Math.round(audio.currentTime * 1000);
    const dur = Number.isFinite(audio.duration) && audio.duration > 0
      ? audio.duration
      : (currentSong.duration || 0);
    a.timestamps = dur ? { start, end: start + Math.round(dur * 1000) } : { start };
  }
  return a;
}

function dcPause() {
  if (!discordEnabled) return;
  dcLastRefresh = Date.now();
  dcPost({ enabled: true, activity: dcActivity(true) });
}

function dcPost(body: { enabled: boolean; activity?: Record<string, unknown> | null; remember?: boolean }) {
  void getJSON<{ ok: boolean }>(`${API}/api/discord`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }).catch(() => undefined);
}

function pushDiscord(force = false) {
  const now = Date.now();
  if (!discordEnabled || now - dcLastRefresh < (force ? 0 : 30000)) return;
  dcLastRefresh = now;
  dcPost({ enabled: true, activity: dcActivity(audio.paused) });
}

function dcClear() {
  if (!discordEnabled) return;
  dcPost({ enabled: true, activity: null });
}

function pollDiscordStatus() {
  if (!discordEnabled) return;
  void getJSON<{ state?: string }>(`${API}/api/discord/status?alive=1`)
    .then((d) => {
      if (!discordEnabled) return;
      if (d.state === 'connected') setDiscordStatus('connected');
      else if (d.state === 'connecting') setDiscordStatus('connecting');
      else if (d.state === 'off') {
        setDiscordStatus('connecting');
        pushDiscord(true);
      } else setDiscordStatus('not-running');
    })
    .catch(() => {
      if (discordEnabled) setDiscordStatus('error');
    });
}

function syncDiscordUI() {
  ($('#set-discord') as HTMLInputElement).checked = discordEnabled;
  if (discordEnabled) {
    dcPost({ enabled: true, activity: dcActivity() });
    dcLastRefresh = Date.now();
    pollDiscordStatus();
  } else {
    setDiscordStatus('off');
  }
}

$('#set-discord').addEventListener('change', (e) => {
  discordEnabled = (e.target as HTMLInputElement).checked;
  store('ns_discord', discordEnabled);
  dcLastRefresh = 0;
  if (discordEnabled) {
    pollDiscordStatus();
    dcPost({ enabled: true, activity: dcActivity(audio.paused), remember: true });
  } else {
    dcPost({ enabled: false, activity: null, remember: true });
    setDiscordStatus('off');
  }
});

async function initDiscord() {
  let remote: boolean | null = null;
  let remoteHidden: string[] | null = null;
  try {
    const d = await getJSON<{ enabled?: boolean | null; hidden?: string[] | null }>(`${API}/api/discord/status`);
    if (typeof d.enabled === 'boolean') remote = d.enabled;
    if (Array.isArray(d.hidden)) remoteHidden = d.hidden.filter((x) => typeof x === 'string');
  } catch {}
  if (discTouched) {
    discPushHidden();
  } else if (remoteHidden !== null) {
    store('ns_discord_hidden', remoteHidden);
    syncAllDiscBtns();
  } else if (discHiddenIds().length) {
    discPushHidden();
  }
  if (remote !== null) {
    discordEnabled = remote;
    store('ns_discord', discordEnabled);
  } else if (discordEnabled) {
    dcPost({ enabled: true, activity: null, remember: true });
  }
  syncDiscordUI();
}

setInterval(pollDiscordStatus, 2000);

window.addEventListener('pagehide', () => {
  if (!discordEnabled || !navigator.sendBeacon) return;
  const body = new Blob(
    [JSON.stringify({ enabled: false, activity: null })],
    { type: 'application/json' },
  );
  navigator.sendBeacon(`${API}/api/discord`, body);
});

// --- DISCORD BOT SYNC ---
let botEnabled = false;
let botLinked = false;
let botLastRefresh = 0;

type BotInfo = {
  enabled?: boolean;
  url?: string;
  linked?: boolean;
  user?: { id?: string; name?: string } | null;
  last?: { at?: number; ok?: boolean | null; error?: string };
};

function setBotStatus(text: string, cls: '' | 'ok' | 'warn' | 'err' = '') {
  const el = $('#set-bot-status');
  el.classList.remove('ok', 'warn', 'err');
  el.textContent = text;
  if (cls) el.classList.add(cls);
}

function botNote(msg: string) {
  $('#bot-note').textContent = msg;
}

function botPost(body: Record<string, unknown>, path = '/api/bot') {
  return getJSON<Record<string, unknown>>(`${API}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function syncBotUI(info: BotInfo) {
  botEnabled = !!info.enabled;
  botLinked = !!info.linked;
  ($('#set-bot') as HTMLInputElement).checked = botEnabled;
  if (info.url) ($('#bot-url') as HTMLInputElement).value = info.url;
  ($('#bot-unlink') as HTMLButtonElement).disabled = !botLinked;
  if (botLinked) {
    const name = info.user?.name || '';
    if (botEnabled) setBotStatus(name ? t('set.bot_linked_as', { name }) : t('set.bot_linked'), 'ok');
    else setBotStatus(name ? t('set.bot_paused_as', { name }) : t('set.bot_paused'), 'warn');
  } else {
    setBotStatus(t('set.bot_not_linked'), '');
  }
}

async function loadBot() {
  try {
    const info = await getJSON<BotInfo>(`${API}/api/bot`);
    syncBotUI(info);
    if (botLinked && botEnabled && info.last && info.last.ok === false) {
      botNote(t('bot.last_fail', { err: info.last.error || t('bot.unreachable') }));
    }
  } catch {
    setBotStatus(t('set.dc_err'), 'err');
  }
}

function reportEvent(event: 'start' | 'pause' | 'resume' | 'progress' | 'stop' | 'hidden', song?: Song | null) {
  if (!botEnabled || !botLinked) return;
  const target = song || currentSong;
  const starting = event === 'start';
  const body: Record<string, unknown> = {
    event,
    position: starting ? 0 : Math.round(audio.currentTime || 0),
    duration: starting
      ? (target?.duration || 0)
      : (Number.isFinite(audio.duration) && audio.duration > 0 ? Math.round(audio.duration) : 0),
    songId: target ? target.id : '',
  };
  if (starting && target) {
    body.song = {
      id: target.id,
      title: target.title,
      channel: target.channel,
      duration: target.duration || 0,
      duration_string: target.duration_string || '',
      kind: target.kind === 'quran' ? 'quran' : 'nasheed',
      local: !!target.local,
    };
  }
  void botPost(body, '/api/report').catch(() => undefined);
}

function pushBot(force = false) {
  const now = Date.now();
  if (!botEnabled || !botLinked) return;
  if (now - botLastRefresh < (force ? 0 : 30000)) return;
  botLastRefresh = now;
  reportEvent(audio.paused ? 'pause' : 'progress');
}

$('#set-bot').addEventListener('change', (e) => {
  botEnabled = (e.target as HTMLInputElement).checked;
  void botPost({ enabled: botEnabled }).catch(() => undefined);
  if (botEnabled && botLinked && currentSong) {
    botLastRefresh = 0;
    reportEvent(discIsHidden(currentSong.id) ? 'hidden' : 'start', currentSong);
  }
  void loadBot();
});

$('#bot-url').addEventListener('change', (e) => {
  const url = (e.target as HTMLInputElement).value.trim();
  void botPost({ url }).catch(() => undefined);
});

$('#bot-link').addEventListener('click', () => {
  const code = ($('#bot-code') as HTMLInputElement).value.trim();
  const url = ($('#bot-url') as HTMLInputElement).value.trim();
  if (!code) {
    botNote(t('set.bot_sub'));
    return;
  }
  botNote(t('bot.testing'));
  void botPost({ code, url }, '/api/bot/link')
    .then((d) => {
      if (!d.ok) {
        botNote(String(d.error || 'That code did not work'));
        return;
      }
      ($('#bot-code') as HTMLInputElement).value = '';
      const name = (d.user as { name?: string } | undefined)?.name;
      botNote(name ? t('set.bot_linked_as', { name }) + '. ' + t('set.send_play') : t('set.bot_linked'));
      toast(t('bot.linked_ok'));
      void loadBot();
    })
    .catch(() => botNote(t('bot.backend_fail')));
});

$('#bot-unlink').addEventListener('click', () => {
  void botPost({}, '/api/bot/unlink')
    .then(() => {
      botNote(t('set.bot_sub'));
      toast(t('bot.unlinked_ok'));
      void loadBot();
    })
    .catch(() => botNote(t('bot.backend_fail')));
});

$('#bot-test').addEventListener('click', () => {
  const url = ($('#bot-url') as HTMLInputElement).value.trim();
  botNote(t('bot.testing'));
  void botPost({ url })
    .then(() => getJSON<{ ok?: boolean; version?: string; error?: string }>(`${API}/api/bot/test`, { method: 'POST' }))
    .then((d) => {
      if (d.ok) botNote(t('bot.reachable', { v: d.version || t('set.unknown_lower') }));
      else botNote(String(d.error || t('bot.no_response')));
    })
    .catch(() => botNote(t('bot.no_response')));
});

window.addEventListener('pagehide', () => {
  if (!botEnabled || !botLinked || !navigator.sendBeacon) return;
  const body = new Blob([JSON.stringify({ event: 'stop' })], { type: 'application/json' });
  navigator.sendBeacon(`${API}/api/report`, body);
});

// --- SETTINGS ---
let appVersion = '';

type UpdateAsset = { name: string; size: number; url: string };
type UpdateRelease = {
  tag: string;
  name: string;
  prerelease: boolean;
  published_at: string | null;
  asset: UpdateAsset | null;
};
type UpdateStatus = {
  state: string;
  tag: string;
  asset: string;
  downloaded: number;
  total: number;
  path: string;
  error: string;
};
let updateBusy = false;
let updatePoll: number | null = null;
let latestTag = '';
let includePrerelease = load<boolean>('ns_prerelease', false);

const $settingsVolOrigin = $('#settings-volume-bar');
const settingsVol = new Slider($settingsVolOrigin);

function syncSettingsVol() {
  const p = Math.round(vol.getValue());
  settingsVol.setValue(p);
  $('#set-vol-label').textContent = p + '%';
}

settingsVol.onInput = (p) => {
  audio.volume = p / 100;
  store('ns_vol', Math.round(p));
  vol.setValue(p);
  updateVolIcon();
  $('#set-vol-label').textContent = Math.round(p) + '%';
};

function syncHistoryCounts() {
  $('#set-hist-searches').textContent = String(scLoadRecents().length);
  $('#set-hist-played').textContent = String(load<Song[]>('ns_recent', []).length);
}

async function loadCacheCount() {
  try {
    const d = await getJSON<{ entries: number }>(`${API}/api/cache`);
    $('#set-cache-entries').textContent = String(d.entries);
  } catch {
    $('#set-cache-entries').textContent = t('set.unknown_lower');
  }
}

async function loadLibraryCounts() {
  try {
    const d = await getJSON<{ songs: Song[]; playlists: Playlist[] }>(`${API}/api/library`);
    const plain = d.songs.filter((s) => !s.local);
    $('#set-lib-count').textContent = String(plain.length);
    $('#set-pl-count').textContent = String(d.playlists.length);
    $('#set-dl-count').textContent = String(plain.filter((s) => s.downloaded).length);
    $('#set-local-count').textContent = String(d.songs.filter((s) => s.local).length);
  } catch {
    $('#set-lib-count').textContent = t('set.unknown_lower');
    $('#set-pl-count').textContent = t('set.unknown_lower');
    $('#set-dl-count').textContent = t('set.unknown_lower');
    $('#set-local-count').textContent = t('set.unknown_lower');
  }
}

type ClearOpts = { nasheeds: boolean; playlists: boolean; downloads: boolean; local: boolean };

const clearOptIds: Array<[keyof ClearOpts, string]> = [
  ['nasheeds', '#clear-nasheeds'],
  ['playlists', '#clear-playlists'],
  ['downloads', '#clear-downloads'],
  ['local', '#clear-local'],
];

function readClearOpts(): ClearOpts {
  const o: ClearOpts = { nasheeds: false, playlists: false, downloads: false, local: false };
  for (const [k, sel] of clearOptIds) o[k] = ($(sel) as HTMLInputElement).checked;
  return o;
}

function updateClearBtn(o: ClearOpts) {
  $('#set-clear-library').toggleAttribute('disabled', !(o.nasheeds || o.playlists || o.downloads || o.local));
}

function syncClearOpts() {
  const o = readClearOpts();
  store('ns_libclear', o);
  updateClearBtn(o);
}

function applyClearOpts() {
  const saved = load<Partial<ClearOpts>>('ns_libclear', {});
  clearOptIds.forEach(([k, sel]) => {
    ($(sel) as HTMLInputElement).checked = saved[k] ?? true;
  });
  updateClearBtn(readClearOpts());
}

clearOptIds.forEach(([, sel]) => $(sel).addEventListener('change', syncClearOpts));

async function loadSettings() {
  try {
    const d = await getJSON<{ version?: string }>(`${API}/api/version`);
    appVersion = d.version || '';
    $('#set-version').textContent = appVersion ? 'v' + appVersion : 'unknown';
  } catch {
    $('#set-version').textContent = t('set.unknown_lower');
  }
  applyPrereleaseChannel();
  syncHistoryCounts();
  void loadCacheCount();
  void loadLibraryCounts();
  applyClearOpts();
}

$('#set-clear-history').addEventListener('click', async () => {
  const ok = await confirmDialog(t('set.clear_history'), t('set.clear_history_q'));
  if (!ok) return;
  store('ns_recentq', []);
  store('ns_recent', []);
  scItems = [];
  scCleared = [];
  scRenderRows(false);
  if (currentLibMode === 'recent') loadLib('recent');
  syncHistoryCounts();
  $('#set-history-note').textContent = t('set.history_cleared');
  toast(t('set.history_cleared'));
});

$('#set-clear-library').addEventListener('click', async () => {
  const o = readClearOpts();
  const parts: string[] = [];
  if (o.nasheeds) parts.push(t('set.part_nasheeds'));
  if (o.playlists) parts.push(t('set.part_playlists'));
  if (o.downloads) parts.push(t('set.part_downloads'));
  if (o.local) parts.push(t('set.part_local'));
  const what = parts.length > 1 ? parts.slice(0, -1).join(', ') + ' ' + t('set.word_and') + ' ' + parts[parts.length - 1] : parts[0];
  const ok = await confirmDialog(t('set.clear_library'), t('set.clear_confirm', { what }));
  if (!ok) return;
  try {
    await getJSON<{ ok: boolean }>(`${API}/api/library/clear`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(o),
    });
    void loadLibraryCounts();
    void loadPlaylists();
    downloadedIds.clear();
    dlActive.clear();
    void (async () => {
      try {
        const lib = await getJSON<Library>(`${API}/api/library`);
        (lib.songs || []).forEach((s) => {
          if (s.downloaded || s.local) downloadedIds.add(s.id);
        });
        if (currentSong) currentSong.downloaded = downloadedIds.has(currentSong.id);
      } catch {}
    })();
    if (currentLibMode) void loadLib(currentLibMode);
    $('#set-lib-note').textContent = t('set.lib_cleared');
    toast(t('set.lib_cleared'));
  } catch {
    $('#set-lib-note').textContent = t('set.lib_clear_fail');
    toast(t('set.lib_clear_fail'));
  }
});

$('#set-clear-cache').addEventListener('click', async () => {
  const ok = await confirmDialog(t('set.clear_cache'), t('set.clear_cache_q'));
  if (!ok) return;
  try {
    const d = await getJSON<{ ok: boolean; entries: number }>(`${API}/api/cache/clear`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });
    $('#set-cache-entries').textContent = String(d.entries);
    $('#set-cache-note').textContent = t('set.cache_cleared');
    toast(t('set.cache_cleared'));
  } catch {
    $('#set-cache-note').textContent = t('set.cache_clear_fail');
    toast(t('set.cache_clear_fail'));
  }
});

async function loadSidebarVersion() {
  const ver = $('#sidebar-ver');
  try {
    const d = await getJSON<{ version?: string }>(`${API}/api/version`);
    if (d.version) ver.textContent = 'v' + d.version;
  } catch {
    ver.textContent = '';
  }
}

$('#set-check').addEventListener('click', () => {
  void loadReleases(true);
});

function fmtMB(n: number): string {
  if (!n || n <= 0) return '';
  return (n / 1048576).toFixed(1) + ' MB';
}

function setUpdateBusy(busy: boolean) {
  updateBusy = busy;
  $('#set-check').classList.toggle('disabled', busy);
  ($('#set-update') as HTMLButtonElement).disabled = busy;
}

function semverParts(tag: string): { nums: number[]; pre: string[] } {
  const m = tag.replace(/^v/i, '').match(/^(\d+(?:\.\d+)*)(?:-([0-9A-Za-z.-]+))?/);
  const nums = (m ? m[1] : '0').split('.').map((n) => parseInt(n, 10) || 0);
  const pre = m && m[2] ? m[2].split('.') : [];
  return { nums, pre };
}

function cmpSemver(a: string, b: string): number {
  const pa = semverParts(a);
  const pb = semverParts(b);
  const len = Math.max(pa.nums.length, pb.nums.length);
  for (let i = 0; i < len; i++) {
    const x = pa.nums[i] || 0;
    const y = pb.nums[i] || 0;
    if (x !== y) return x < y ? -1 : 1;
  }
  if (pa.pre.length === 0 && pb.pre.length === 0) return 0;
  if (pa.pre.length === 0) return 1;
  if (pb.pre.length === 0) return -1;
  const STAGE_RANK: Record<string, number> = { 'pre-alpha': 0, alpha: 1, beta: 2, rc: 3 };
  const ra = pa.pre[0] ? STAGE_RANK[pa.pre[0]] : undefined;
  const rb = pb.pre[0] ? STAGE_RANK[pb.pre[0]] : undefined;
  if (ra !== undefined && rb !== undefined && ra !== rb) return ra < rb ? -1 : 1;
  const plen = Math.max(pa.pre.length, pb.pre.length);
  for (let i = 0; i < plen; i++) {
    const sa = pa.pre[i];
    const sb = pb.pre[i];
    if (sa === undefined) return -1;
    if (sb === undefined) return 1;
    const na = /^\d+$/.test(sa) ? parseInt(sa, 10) : null;
    const nb = /^\d+$/.test(sb) ? parseInt(sb, 10) : null;
    if (na !== null && nb !== null) {
      if (na !== nb) return na < nb ? -1 : 1;
    } else if (na !== null) {
      return -1;
    } else if (nb !== null) {
      return 1;
    } else if (sa !== sb) {
      return sa < sb ? -1 : 1;
    }
  }
  return 0;
}

async function loadReleases(refresh: boolean) {
  const note = $('#set-check-note');
  note.textContent = t('upd.checking');
  if (refresh) $('#set-update').setAttribute('disabled', '');
  try {
    const d = await getJSON<{ current: string; releases: UpdateRelease[]; error?: string | null }>(
      `${API}/api/updates${refresh ? '?refresh=1' : ''}`,
    );
    const rels = d.releases || [];
    const cur = d.current || '';
    const installable = rels.find((r) => r.asset && (includePrerelease || !r.prerelease));
    $('#set-latest').textContent = rels[0] ? rels[0].tag : t('set.unknown_lower');
    if (!installable) {
      latestTag = '';
      note.textContent = t('upd.no_installer');
      $('#set-update').setAttribute('disabled', '');
      return;
    }
    latestTag = installable.tag;
    if (cmpSemver(installable.tag, cur) <= 0) {
      note.textContent = t('upd.newest');
      $('#set-update').setAttribute('disabled', '');
    } else {
      note.textContent = (d.error ? t('upd.cached_showing') : '') + t('upd.available', { tag: installable.tag });
      $('#set-update').removeAttribute('disabled');
    }
  } catch {
    note.textContent = t('upd.reach_fail');
  }
}

function applyPrereleaseChannel() {
  ($('#set-prerelease') as HTMLInputElement).checked = includePrerelease;
  void loadReleases(false);
}

$('#set-prerelease').addEventListener('change', (e) => {
  includePrerelease = (e.target as HTMLInputElement).checked;
  store('ns_prerelease', includePrerelease);
  latestTag = '';
  applyPrereleaseChannel();
});

function startUpdatePoll() {
  if (updatePoll !== null) return;
  updatePoll = window.setInterval(pollUpdate, 700);
  void pollUpdate();
}

function stopUpdatePoll() {
  if (updatePoll !== null) {
    clearInterval(updatePoll);
    updatePoll = null;
  }
}

async function pollUpdate() {
  let s: UpdateStatus;
  try {
    s = await getJSON<UpdateStatus>(`${API}/api/update/status`);
  } catch {
    return;
  }
  const wrap = $('#set-progress-wrap');
  const fill = $('#set-progress-fill');
  const text = $('#set-progress-text');
  const note = $('#set-check-note');
  const runBtn = $('#set-run') as HTMLButtonElement;
  if (s.state === 'downloading') {
    wrap.hidden = false;
    runBtn.hidden = true;
    const pct = s.total ? Math.round((s.downloaded / s.total) * 100) : 0;
    fill.style.width = pct + '%';
    text.textContent = t('upd.dl_progress', { a: fmtMB(s.downloaded) + (s.total ? ' / ' + fmtMB(s.total) : ''), b: s.total ? ' (' + pct + '%)' : '' });
    note.textContent = t('upd.downloading', { tag: s.tag });
    setUpdateBusy(true);
    return;
  }
  stopUpdatePoll();
  setUpdateBusy(false);
  if (s.state === 'installed') {
    wrap.hidden = true;
    runBtn.hidden = true;
    note.innerHTML = 'Updated to <b>' + esc(s.tag) + '</b>. Restart Quran to use it.';
  } else if (s.state === 'downloaded') {
    wrap.hidden = true;
    runBtn.hidden = false;
    note.innerHTML = 'Downloaded <b>' + esc(s.tag) + '</b> to <code>' + esc(s.path) + '</code>. Run it to use the new version.';
  } else if (s.state === 'launched') {
    wrap.hidden = true;
    runBtn.hidden = true;
    note.innerHTML = 'Opened the <b>' + esc(s.tag) + '</b> installer. Follow its steps, then reopen Quran.';
  } else if (s.state === 'error') {
    wrap.hidden = true;
    runBtn.hidden = true;
    note.textContent = t('upd.failed', { err: s.error || t('set.unknown_lower') });
  }
}

$('#set-update').addEventListener('click', async () => {
  if (updateBusy) return;
  const tag = latestTag;
  const note = $('#set-check-note');
  if (!tag) {
    note.textContent = t('upd.check_first');
    return;
  }
  const cur = appVersion;
  if (cmpSemver(tag, cur) <= 0) {
    note.textContent = t('upd.already', { tag });
    return;
  }
  setUpdateBusy(true);
  note.textContent = t('upd.starting', { tag });
  try {
    const r = await fetch(`${API}/api/update`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tag }),
    });
    const d = (await r.json()) as { ok?: boolean; error?: string };
    if (!r.ok || !d.ok) {
      note.textContent = d.error || t('upd.start_fail');
      setUpdateBusy(false);
      return;
    }
    startUpdatePoll();
  } catch {
    note.textContent = t('upd.reach_updater');
    setUpdateBusy(false);
  }
});

$('#set-run').addEventListener('click', async () => {
  const r = await fetch(`${API}/api/update/run`, { method: 'POST' });
  const d = (await r.json()) as { ok?: boolean; error?: string };
  if (!d.ok) toast(d.error || t('upd.start_fail'));
});

$$('.lang-opt').forEach((b) =>
  b.addEventListener('click', () => {
    const lang = b.dataset.uiLang as Lang;
    if (!lang || lang === uiLang) return;
    uiLang = lang;
    store('ns_lang', uiLang);
    refreshForLang();
  })
);

try {
  if ('mediaSession' in navigator) {
    navigator.mediaSession.setActionHandler('play', () => {
      audio.play().catch(playError);
    });
    navigator.mediaSession.setActionHandler('pause', () => {
      audio.pause();
    });
    navigator.mediaSession.setActionHandler('previoustrack', () => $('#prev-btn').click());
    navigator.mediaSession.setActionHandler('nexttrack', () => $('#next-btn').click());
  }
} catch {}

loopMode = load<LoopMode>('ns_loop', 'off');
$('#loop-btn').classList.toggle('active', loopMode !== 'off');
$('#loop-btn').title = t('player.loop');
shuffleOn = load<boolean>('ns_shuffle', false);
$('#shuffle-btn').classList.toggle('active', shuffleOn);
$('#shuffle-btn').title = t('player.shuffle');
sortMode = load<SortMode>('ns_sort', 'added');
syncSortUI();
updateVolIcon();
applyStaticI18n();
scItems = scLoadRecents();
scRenderRows(false);
if (/Mac|iPhone|iPad/.test(navigator.platform)) scKbd.textContent = '⌘K';
loadPlaylists();
void initDownloads();
void loadQuranReciters();
syncSettingsVol();
void initDiscord();
void loadBot();
void loadSidebarVersion();
