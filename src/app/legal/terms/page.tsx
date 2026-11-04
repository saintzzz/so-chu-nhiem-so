const H2 = ({ children }: { children: React.ReactNode }) => (
  <h2 className="mt-8 text-lg font-semibold text-foreground">{children}</h2>
);
const P = ({ children }: { children: React.ReactNode }) => (
  <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{children}</p>
);
const Li = ({ children }: { children: React.ReactNode }) => (
  <li className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{children}</li>
);

export const metadata = { title: "Điều khoản sử dụng - Sổ Chủ Nhiệm Số" };

export default function TermsPage() {
  return (
    <article>
      <h1 className="text-2xl font-bold">Điều khoản sử dụng dịch vụ</h1>
      <P>
        Điều khoản này điều chỉnh việc sử dụng nền tảng Sổ Chủ Nhiệm Số -
        VieSchool giữa đơn vị phát triển (đại diện pháp lý: ông Lê Duy Linh,
        email linhld@vieschool.com) và trường học/người dùng được trường cấp
        tài khoản. Việc đăng ký hoặc sử dụng dịch vụ đồng nghĩa chấp nhận điều
        khoản này, theo pháp luật giao dịch điện tử Việt Nam.
      </P>

      <H2>1. Dịch vụ</H2>
      <P>
        Nền tảng SaaS quản lý trường học gồm các phân hệ: quản lý chung, hỗ trợ
        dạy - học, chăm sóc phụ huynh - học sinh, báo cáo và tích hợp. Phân hệ
        được bật - tắt theo gói đăng ký của từng trường.
      </P>

      <H2>2. Vai trò và trách nhiệm về dữ liệu</H2>
      <ul className="list-disc pl-5">
        <Li>Trường là bên kiểm soát dữ liệu cá nhân của giáo viên, học sinh, cha
          mẹ học sinh nhập vào hệ thống.</Li>
        <Li>Trường có nghĩa vụ thu thập đồng thuận hợp lệ của cha mẹ/người giám
          hộ trước khi nhập dữ liệu học sinh, và đảm bảo dữ liệu nhập là chính
          xác, có thẩm quyền.</Li>
        <Li>Đơn vị phát triển là bên xử lý dữ liệu theo chỉ đạo của trường, trong
          phạm vi cung cấp dịch vụ, theo Chính sách bảo mật đã công bố.</Li>
        <Li>Trường không được nhập dữ liệu giả mạo, dữ liệu của cá nhân không có
          sự cho phép, hoặc dùng dịch vụ cho mục đích ngoài nghiệp vụ trường học.</Li>
      </ul>

      <H2>3. Tài khoản và dùng thử</H2>
      <P>
        Tài khoản do quản trị trường hoặc đơn vị phát triển cấp, gắn với vai trò
        nghiệp vụ. Người dùng có trách nhiệm giữ bí mật thông tin đăng nhập và
        báo ngay khi nghi ngờ lộ tài khoản. Tài khoản dùng thử (trial) được cấp
        với phạm vi phân hệ giới hạn, có thể bị thu hồi hoặc điều chỉnh phạm vi
        bất kỳ lúc nào phục vụ mục đích đánh giá sản phẩm.
      </P>

      <H2>4. Sử dụng hợp lệ</H2>
      <P>
        Người dùng không được: sao chép, nhân bản, dịch ngược mã nguồn; truy cập
        trái phép dữ liệu của trường khác; dùng công cụ tự động thu thập dữ liệu
        hệ thống (scraping); cố vượt qua cơ chế phân quyền hoặc giới hạn phân hệ;
        tải lên nội dung vi phạm pháp luật.
      </P>

      <H2>5. Sở hữu trí tuệ</H2>
      <P>
        Toàn bộ mã nguồn, thiết kế, tài liệu, thương hiệu của nền tảng thuộc sở
        hữu đơn vị phát triển. Dữ liệu trường nhập thuộc sở hữu/trách nhiệm của
        trường - đơn vị phát triển không tuyên bố quyền sở hữu dữ liệu khách
        hàng. Câu hỏi, nội dung do AI tạo trong hệ thống được cấp quyền sử dụng
        trong phạm vi nghiệp vụ của trường; giáo viên chịu trách nhiệm rà soát
        nội dung AI trước khi dùng với học sinh.
      </P>

      <H2>6. Phí và thanh toán</H2>
      <P>
        Mức phí, gói phân hệ và chu kỳ thanh toán được thống nhất bằng văn bản
        riêng với từng trường. Việc thanh toán thực hiện qua chuyển khoản hoặc
        cổng thanh toán điện tử hợp pháp; hóa đơn được xuất theo quy định thuế
        hiện hành.
      </P>

      <H2>7. Tính khả dụng và giới hạn trách nhiệm</H2>
      <ul className="list-disc pl-5">
        <Li>Dịch vụ cam kết nỗ lực duy trì sẵn sàng cao, sửa lỗi nghiêm trọng
          trong ngày làm việc; có thể gián đoạn để bảo trì có thông báo trước.</Li>
        <Li>Đơn vị phát triển không chịu trách nhiệm cho thiệt hại gián tiếp,
          mất doanh thu, hoặc thiệt hại do trường nhập dữ liệu sai/vi phạm, do
          người dùng để lộ tài khoản, hoặc do sự cố ngoài khả năng kiểm soát
          (bất khả kháng, sự cố nhà cung cấp hạ tầng).</Li>
        <Li>Tổng trách nhiệm bồi thường (nếu có) không vượt quá phí dịch vụ
          trường đã trả trong 6 tháng gần nhất.</Li>
      </ul>

      <H2>8. Chấm dứt và xử lý dữ liệu</H2>
      <P>
        Khi chấm dứt sử dụng, trường được hỗ trợ xuất toàn bộ dữ liệu ở định
        dạng phổ biến trong 30 ngày; sau đó dữ liệu được xóa khỏi môi trường
        hoạt động, trừ phần pháp luật bắt buộc lưu giữ hoặc đã ẩn danh hóa.
        Đơn vị phát triển có quyền tạm ngừng tài khoản vi phạm Điều 4 sau cảnh
        báo.
      </P>

      <H2>9. Luật áp dụng và tranh chấp</H2>
      <P>
        Điều khoản này điều chỉnh bởi pháp luật Việt Nam. Tranh chấp ưu tiên
        giải quyết bằng thương lượng trong 30 ngày; không thành công thì đưa ra
        Tòa án nhân dân có thẩm quyền.
      </P>

      <H2>10. Liên hệ</H2>
      <P>
        Mọi thắc mắc về điều khoản hoặc dữ liệu cá nhân: <strong>linhld@vieschool.com</strong>.
      </P>
    </article>
  );
}
