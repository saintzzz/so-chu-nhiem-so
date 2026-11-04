const H2 = ({ children }: { children: React.ReactNode }) => (
  <h2 className="mt-8 text-lg font-semibold text-foreground">{children}</h2>
);
const P = ({ children }: { children: React.ReactNode }) => (
  <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{children}</p>
);
const Li = ({ children }: { children: React.ReactNode }) => (
  <li className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{children}</li>
);

export const metadata = { title: "Chính sách bảo mật - Sổ Chủ Nhiệm Số" };

export default function PrivacyPage() {
  return (
    <article>
      <h1 className="text-2xl font-bold">Chính sách bảo mật dữ liệu cá nhân</h1>
      <P>
        Văn bản này là thông báo xử lý dữ liệu cá nhân theo Luật Bảo vệ dữ liệu
        cá nhân số 91/2025/QH15 và Nghị định 13/2023/NĐ-CP, áp dụng cho người
        dùng nền tảng Sổ Chủ Nhiệm Số - VieSchool.
      </P>

      <H2>1. Đơn vị kiểm soát và đơn vị xử lý dữ liệu</H2>
      <ul className="list-disc pl-5">
        <Li>
          Trường học sử dụng dịch vụ là <strong>bên kiểm soát dữ liệu</strong> đối với
          dữ liệu cá nhân của giáo viên, học sinh và cha mẹ học sinh được nhập
          vào hệ thống. Trường chịu trách nhiệm xác lập cơ sở pháp lý để thu
          thập và xử lý, bao gồm đồng thuận của cha mẹ/người giám hộ đối với dữ
          liệu học sinh là trẻ em.
        </Li>
        <Li>
          Đơn vị phát triển VieSchool (đại diện pháp lý: ông Lê Duy Linh, email
          linhld@vieschool.com) là <strong>bên xử lý dữ liệu</strong>, xử lý theo chỉ đạo
          của trường trong phạm vi cung cấp dịch vụ.
        </Li>
      </ul>

      <H2>2. Loại dữ liệu được xử lý</H2>
      <ul className="list-disc pl-5">
        <Li>Tài khoản và định danh: họ tên, email, vai trò, mã định danh nội bộ.</Li>
        <Li>Dữ liệu nghiệp vụ trường học: lớp học, điểm danh, điểm số, hạnh kiểm,
          hồ sơ học tập, thời khóa biểu, công văn, hồ sơ tuyển sinh.</Li>
        <Li>
          <strong>Dữ liệu cá nhân nhạy cảm</strong> (chỉ khi trường bật module tương ứng):
          số đo sức khỏe, thông tin thẻ BHYT (module Sổ y tế). Module camera
          điểm danh nếu triển khai sẽ xử lý dữ liệu sinh trắc và sẽ được thông
          báo riêng trước khi bật.
        </Li>
        <Li>Dữ liệu kỹ thuật: nhật ký truy cập, địa chỉ IP, thông tin phiên đăng
          nhập phục vụ bảo mật và chẩn đoán lỗi.</Li>
      </ul>

      <H2>3. Mục đích xử lý</H2>
      <ul className="list-disc pl-5">
        <Li>Cung cấp và vận hành các phân hệ quản lý trường học theo đăng ký của trường.</Li>
        <Li>Gửi email thông báo nghiệp vụ (ví dụ thông báo đến cha mẹ học sinh) theo cấu hình của trường.</Li>
        <Li>Hỗ trợ kỹ thuật, chẩn đoán lỗi, cải tiến chất lượng dịch vụ ở dạng tổng hợp ẩn danh.</Li>
        <Li>Tuân thủ nghĩa vụ pháp lý khi có yêu cầu hợp lệ của cơ quan nhà nước.</Li>
      </ul>

      <H2>4. Bên thứ ba nhận dữ liệu và chuyển dữ liệu ra nước ngoài</H2>
      <P>
        Dịch vụ vận hành trên hạ tầng của các nhà cung cấp sau, có thể đặt máy
        chủ ngoài Việt Nam. Việc chuyển dữ liệu ra nước ngoài được thực hiện
        kèm hợp đồng bảo vệ dữ liệu với từng nhà cung cấp và hồ sơ đánh giá
        tác động theo Nghị định 356/2025:
      </P>
      <ul className="list-disc pl-5">
        <Li>Supabase Inc - cơ sở dữ liệu và xác thực người dùng.</Li>
        <Li>Vercel Inc - hạ tầng chạy ứng dụng web.</Li>
        <Li>Resend - gửi email giao dịch đến giáo viên và cha mẹ học sinh.</Li>
        <Li>
          Các nhà cung cấp AI (Google Gemini, OpenAI, Anthropic, OpenRouter) -
          chỉ nhận nội dung tối thiểu phục vụ tính năng AI. Hệ thống tự động
          che định danh (email, số điện thoại, số CCCD) và ẩn danh hóa tên học
          sinh trước khi gửi ra các nhà cung cấp này.
        </Li>
      </ul>

      <H2>5. Dữ liệu của trẻ em</H2>
      <P>
        Đối tượng sử dụng bao gồm học sinh dưới 16 tuổi - dữ liệu cá nhân trẻ em
        được xử lý có sự bảo vệ đặc biệt. Trường học với tư cách bên kiểm soát
        chịu trách nhiệm thu thập đồng thuận của cha mẹ/người giám hộ và đồng
        ý của học sinh từ 7 tuổi trở lên theo quy định. Chúng tôi không tiếp
        thị hay bán dữ liệu học sinh cho bên thứ ba.
      </P>

      <H2>6. Thời gian lưu trữ</H2>
      <P>
        Dữ liệu được lưu trữ trong thời gian trường sử dụng dịch vụ và theo
        quy định về hồ sơ trường học. Khi chấm dứt hợp đồng, trường được hỗ trợ
        xuất dữ liệu và yêu cầu xóa; dữ liệu tài khoản dùng thử được xóa trong
        tối đa 90 ngày sau khi hết hạn dùng thử.
      </P>

      <H2>7. Bảo mật</H2>
      <P>
        Hệ thống áp dụng: phân quyền theo vai trò đến tầng cơ sở dữ liệu (RLS),
        cách ly dữ liệu theo từng trường, mã hóa đường truyền HTTPS, ghi nhật
        ký thao tác nhạy cảm, và quy trình kiểm tra bảo mật định kỳ. Khi có sự
        cố rò rỉ dữ liệu ảnh hưởng đến chủ thể, chúng tôi tuân thủ quy trình
        thông báo trong 72 giờ theo quy định.
      </P>

      <H2>8. Quyền của chủ thể dữ liệu</H2>
      <P>
        Theo quy định, chủ thể có quyền: được biết về hoạt động xử lý, truy cập,
        chỉnh sửa, yêu cầu xóa, hạn chế hoặc phản đối xử lý, rút lại đồng thuận,
        khiếu nại. Để thực hiện quyền, liên hệ trường học (bên kiểm soát) hoặc
        gửi email tới <strong>linhld@vieschool.com</strong> - chúng tôi phối hợp xử lý trong
        thời hạn quy định.
      </P>

      <H2>9. Thay đổi chính sách</H2>
      <P>
        Khi thay đổi trọng yếu, phiên bản mới được đăng tại trang này kèm ngày
        cập nhật và thông báo cho quản trị viên trường trước khi áp dụng.
      </P>
    </article>
  );
}
