// Nguồn dữ liệu DUY NHẤT mô tả các tính năng ở trang admin — dùng chung cho tour hướng dẫn
// (OnboardingTour.tsx, spotlight theo data-tour) VÀ trang wiki (/admin/huong-dan, đọc trực
// tiếp). Sửa nội dung ở đây là đủ để cả 2 nơi cùng cập nhật — mỗi khi thêm/sửa 1 tính năng ở
// trang admin thì cũng nên thêm/sửa mục tương ứng ở đây (gắn thêm data-tour="<target>" vào
// đúng phần tử JSX nếu muốn tour/wiki trỏ tới được). `icon` là key tra trong ICON_MAP của
// trang wiki (client icon component không để trực tiếp ở đây vì file này còn được import bởi
// OnboardingTour — giữ thuần dữ liệu). `steps` là hướng dẫn thao tác từng bước, chỉ trang wiki
// dùng (tour dùng `description` ngắn gọn hơn vì đã có spotlight trỏ trực tiếp vào phần tử).
export type WikiButton = {
  target: string;
  title: string;
  description: string;
};

export type IconKey =
  | "products"
  | "plus"
  | "import"
  | "gallery"
  | "orders"
  | "search"
  | "menu"
  | "star"
  | "chat"
  | "user"
  | "inbox"
  | "settings";

export type WikiFeature = {
  target: string;
  href: string;
  icon: IconKey;
  title: string;
  description: string;
  steps?: string[];
  buttons?: WikiButton[];
};

export type WikiSection = {
  label: string;
  superAdminOnly?: boolean;
  features: WikiFeature[];
};

export const ADMIN_WIKI: WikiSection[] = [
  {
    label: "Sản phẩm",
    features: [
      {
        target: "admin",
        href: "/admin",
        icon: "products",
        title: "Danh sách sản phẩm",
        description: "Trang chủ quản trị — nơi bạn xem toàn bộ sản phẩm đã đăng và tình trạng bán của từng sản phẩm.",
        steps: [
          "Xem danh sách sản phẩm kèm giá hiện tại và số lượt trả giá.",
          "Bấm vào 1 sản phẩm để xem hoặc sửa chi tiết.",
          "Khi phiên đấu giá kết thúc, dùng nút Đánh dấu đã bán / Đánh dấu đã huỷ ngay ở mỗi dòng.",
        ],
      },
      {
        target: "products-new",
        href: "/admin/products/new",
        icon: "plus",
        title: "Đăng sản phẩm",
        description: "Thêm sản phẩm mới lên sàn: hình ảnh, giá bán, mô tả, danh mục.",
        steps: [
          "Điền tên, mô tả và tình trạng sản phẩm (Mới, Đã dùng - còn tốt...).",
          "Tải lên tối đa 8 ảnh — ảnh đầu tiên sẽ là ảnh đại diện.",
          "Nhập giá khởi điểm, bước giá tối thiểu (và giá Mua ngay nếu muốn cho phép mua nhanh không cần đấu giá).",
          "Thêm thuộc tính nếu cần (vd. màu sắc, dung tích).",
          "Bấm nút Đăng sản phẩm để hoàn tất.",
        ],
        buttons: [
          {
            target: "product-form-submit",
            title: "Nút Đăng sản phẩm",
            description: "Điền xong thông tin thì bấm nút này để đăng sản phẩm lên sàn.",
          },
        ],
      },
      {
        target: "products-import",
        href: "/admin/products/import",
        icon: "import",
        title: "Import Excel",
        description: "Đăng hàng loạt sản phẩm nhanh chóng bằng cách nhập từ file Excel.",
        steps: [
          "Bấm ⬇ Tải file mẫu để lấy đúng định dạng cột.",
          "Điền thông tin từng sản phẩm vào từng dòng trong file mẫu.",
          "Quay lại trang này, chọn file Excel vừa điền.",
          "Bấm nút Import để đăng hàng loạt sản phẩm cùng lúc.",
        ],
        buttons: [
          {
            target: "import-file",
            title: "Chọn file Excel",
            description: "Chọn file Excel đã điền theo mẫu để chuẩn bị import.",
          },
          {
            target: "import-submit",
            title: "Nút Import",
            description: "Bấm để đăng hàng loạt các sản phẩm trong file đã chọn.",
          },
        ],
      },
      {
        target: "gallery",
        href: "/admin/thu-vien-anh",
        icon: "gallery",
        title: "Thư viện ảnh",
        description: "Lưu trữ và tái sử dụng ảnh sản phẩm cho nhiều lần đăng bán khác nhau.",
        steps: [
          "Bấm Chọn tệp rồi chọn 1 hoặc nhiều ảnh từ máy.",
          "Bấm Tải ảnh lên.",
          "Bấm Sao chép link ở ảnh muốn dùng.",
          "Dán link vừa sao chép vào cột \"Ảnh\" khi import sản phẩm hàng loạt bằng Excel.",
        ],
        buttons: [
          {
            target: "gallery-choose-file",
            title: "Chọn tệp",
            description: "Chọn 1 hoặc nhiều ảnh từ máy để tải lên thư viện.",
          },
          {
            target: "gallery-upload",
            title: "Tải ảnh lên",
            description: "Bấm để tải các ảnh vừa chọn lên thư viện, dùng lại cho nhiều sản phẩm.",
          },
        ],
      },
      {
        target: "orders",
        href: "/admin/orders",
        icon: "orders",
        title: "Quản lý đơn hàng",
        description: "Theo dõi trạng thái giao hàng, xử lý và huỷ đơn hàng của khách.",
        steps: [
          "Lọc đơn theo tab trạng thái (Mới, Đang giao, Đã giao...) hoặc tìm theo mã đơn/SĐT.",
          "Bấm vào 1 đơn để xem chi tiết.",
          "Ở trang chi tiết, chọn gói vận chuyển phù hợp rồi bấm Tạo vận đơn GHN.",
          "Bấm Làm mới trạng thái GHN để cập nhật tình trạng giao hàng mới nhất, hoặc Huỷ đơn nếu cần.",
        ],
      },
      {
        target: "facebook-groups",
        href: "/admin/nhom-facebook",
        icon: "search",
        title: "Tìm nhóm Facebook",
        description: "Tìm nhóm Facebook phù hợp và soạn sẵn nội dung để đăng bán sản phẩm.",
        steps: [
          "Nhập từ khoá liên quan đến sản phẩm (cách nhau bởi dấu phẩy nếu tìm nhiều từ).",
          "Bấm nút Tìm kiếm.",
          "Xem danh sách nhóm Facebook phù hợp được trả về.",
          "Soạn nội dung đăng bán rồi bấm mở nhóm để đăng trực tiếp.",
        ],
        buttons: [
          {
            target: "facebook-keywords",
            title: "Ô nhập từ khoá",
            description: "Nhập từ khoá liên quan đến sản phẩm để tìm nhóm Facebook phù hợp.",
          },
          {
            target: "facebook-search",
            title: "Nút Tìm kiếm",
            description: "Bấm để tìm nhóm Facebook theo từ khoá vừa nhập.",
          },
        ],
      },
      {
        target: "fb-inbox",
        href: "/admin/hop-thu-facebook",
        icon: "inbox",
        title: "Hộp thư Facebook",
        description: "Xem và trả lời tin nhắn Messenger + bình luận từ fanpage của bạn ngay tại đây.",
        steps: [
          "Lần đầu dùng: vào menu Cài đặt để kết nối fanpage trước (xem mục Cài đặt bên dưới).",
          "Quản lý nhiều fanpage thì chọn đúng trang muốn xem ở dải tab phía trên (mỗi trang có hội thoại/bình luận riêng, không gộp chung).",
          "Chọn tab Tin nhắn Messenger hoặc Bình luận.",
          "Bấm vào 1 hội thoại để xem tin nhắn, hoặc trả lời trực tiếp dưới mỗi bình luận.",
          "Nhập nội dung trả lời (hoặc bấm nút ảnh để gửi ảnh) rồi bấm Gửi / Trả lời.",
        ],
      },
    ],
  },
  {
    label: "Quản trị sàn",
    superAdminOnly: true,
    features: [
      {
        target: "categories",
        href: "/admin/danh-muc",
        icon: "menu",
        title: "Quản lý danh mục",
        description: "Tạo và sắp xếp danh mục sản phẩm cho toàn sàn.",
        steps: [
          "Menu điều hướng: thêm/sửa/xoá mục hiển thị ở menu trang chủ.",
          "Thông báo & Tin tức: đăng thông báo mới cho khách xem ở trang chủ.",
          "Banner trang chủ: tải ảnh slideshow và chỉnh thời gian tự chuyển.",
          "Giá tìm nhóm Facebook, giới hạn nạp credit, số dư credit từng người dùng — quản lý ở các mục còn lại trên cùng trang.",
        ],
      },
      {
        target: "trust",
        href: "/admin/settings",
        icon: "star",
        title: "Bằng chứng uy tín",
        description: "Quản lý các bằng chứng, đánh giá giúp tăng độ tin cậy của sàn.",
        steps: [
          "Nhập điểm đánh giá trung bình và số đơn đã bán muốn hiển thị.",
          "Nhập danh sách đánh giá của khách hàng.",
          "Bấm nút Lưu để cập nhật lên trang chủ.",
        ],
        buttons: [
          {
            target: "trust-save",
            title: "Nút Lưu",
            description: "Bấm để lưu lại nội dung bằng chứng uy tín vừa chỉnh sửa.",
          },
        ],
      },
      {
        target: "chat",
        href: "/admin/chat",
        icon: "chat",
        title: "Chat hỗ trợ",
        description: "Trả lời tin nhắn hỗ trợ từ khách hàng và người bán trên sàn.",
        steps: [
          "Chọn 1 cuộc trò chuyện ở danh sách bên trái.",
          "Đọc tin nhắn khách vừa gửi.",
          "Nhập nội dung trả lời rồi bấm nút Gửi.",
        ],
        buttons: [
          {
            target: "chat-input",
            title: "Ô nhập tin nhắn",
            description: "Chọn 1 cuộc trò chuyện ở danh sách bên trái rồi nhập nội dung trả lời ở đây.",
          },
          {
            target: "chat-send",
            title: "Nút Gửi",
            description: "Bấm để gửi tin nhắn trả lời cho khách.",
          },
        ],
      },
    ],
  },
  {
    label: "Tài khoản",
    features: [
      {
        target: "settings",
        href: "/admin/cai-dat",
        icon: "settings",
        title: "Cài đặt",
        description: "Kết nối 1 hoặc nhiều fanpage Facebook để dùng ở Hộp thư Facebook.",
        steps: [
          "Bấm Kết nối với Facebook (hoặc Kết nối thêm fanpage nếu đã có sẵn trang khác), đăng nhập và cấp quyền.",
          "Quản lý nhiều fanpage thì tick chọn 1 hoặc nhiều trang muốn kết nối cùng lúc rồi bấm Kết nối.",
          "Mỗi fanpage đã kết nối hiện thành 1 dòng riêng — bấm Ngắt kết nối ở đúng dòng đó bất kỳ lúc nào.",
        ],
        buttons: [
          {
            target: "settings-connect",
            title: "Nút Kết nối với Facebook / Kết nối thêm fanpage",
            description: "Bấm để chuyển sang Facebook cấp quyền cho 1 hoặc nhiều fanpage muốn quản lý.",
          },
          {
            target: "settings-disconnect",
            title: "Ngắt kết nối",
            description: "Bấm để ngắt kết nối đúng fanpage ở dòng đó.",
          },
        ],
      },
      {
        target: "account",
        href: "/admin/account",
        icon: "user",
        title: "Tài khoản của tôi",
        description: "Cập nhật thông tin tài khoản, nạp credit và xem trang công khai của bạn ở đây.",
        steps: [
          "Sửa tên, số điện thoại rồi bấm Lưu thay đổi.",
          "Đổi mật khẩu ở mục bên dưới nếu cần.",
          "Nạp credit hoặc xem trang công khai qua menu bên trái.",
        ],
        buttons: [
          {
            target: "account-save",
            title: "Nút Lưu thay đổi",
            description: "Bấm để lưu lại thông tin tài khoản vừa chỉnh sửa.",
          },
        ],
      },
    ],
  },
];

export type TourStep = {
  target: string;
  href: string;
  title: string;
  description: string;
};

// Làm phẳng ADMIN_WIKI thành danh sách bước tuần tự cho tour (feature -> từng nút con của nó),
// lọc theo quyền hạn — dùng chung logic hiển thị với sidebar (isSuperAdmin).
export function buildTourSteps(isSuperAdmin: boolean): TourStep[] {
  const steps: TourStep[] = [];
  for (const section of ADMIN_WIKI) {
    if (section.superAdminOnly && !isSuperAdmin) continue;
    for (const feature of section.features) {
      steps.push({ target: feature.target, href: feature.href, title: feature.title, description: feature.description });
      for (const btn of feature.buttons ?? []) {
        steps.push({ target: btn.target, href: feature.href, title: btn.title, description: btn.description });
      }
    }
  }
  return steps;
}
