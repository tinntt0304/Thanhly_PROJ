# PRD: Trang Thanh Lý Sản Phẩm Kiểu Đấu Giá

**Phiên bản:** v1 (MVP)
**Tác giả:** Tín (Product Owner)
**Ngày:** 21/08/2026

---

## 1. Problem Statement

Người bán đang kinh doanh trên các sàn TMĐT (Shopee, TikTok Shop...) nhưng muốn dừng hoạt động do phí sàn chiếm biên lợi nhuận quá cao. Vấn đề còn lại là: làm sao thanh lý toàn bộ hàng tồn kho **nhanh, được giá tốt, và không phải bán lẻ tẻ qua tin nhắn tay đôi** — trong khi không còn giữ được dữ liệu khách hàng cũ (nằm hết trên sàn) và không có kênh bán hàng độc lập nào sẵn có.

Nếu không giải quyết: hàng tồn phải bán tháo giá rẻ qua các nhóm mua bán một cách rời rạc, mất thời gian đàm phán từng đơn, hoặc phải tiếp tục chịu phí sàn thêm một thời gian chờ để xả hàng.

Đây là **sự kiện một lần** (thanh lý xong thì đóng trang), không phải xây kênh bán hàng dài hạn — điều này định hình toàn bộ phạm vi của bản v1.

---

## 2. Goals

1. **Tốc độ xả hàng**: Bán hết ≥80% số lượng sản phẩm đăng thanh lý trong vòng 30 ngày kể từ ngày mở trang.
2. **Giá bán tốt hơn xả rẻ**: Giá chốt trung bình đạt ≥70% giá niêm yết gốc trên sàn (so với thanh lý dọn kho truyền thống thường chỉ đạt 30-50%).
3. **Tỷ lệ chốt kèo thành công**: ≥85% người thắng đấu giá thực sự hoàn tất giao dịch (không bùng).
4. **Giảm công sức vận hành**: Người bán không phải tự nhắn tin đàm phán giá cho từng sản phẩm — hệ thống tự động hóa phần đấu giá và chỉ cần liên hệ khi đã có người thắng.

---

## 3. Non-Goals

1. **Không xây tài khoản/giỏ hàng cho người mua** — vì đây là sự kiện một lần, chi phí xây hệ thống tài khoản không tương xứng với lợi ích. Người mua chỉ cần để lại SĐT khi trả giá.
2. **Không tích hợp thanh toán online** — giao dịch chốt qua liên hệ trực tiếp (SĐT/Zalo), giữ đúng tinh thần thanh lý cá nhân, tránh rủi ro pháp lý và chi phí tích hợp cổng thanh toán cho một chiến dịch ngắn hạn.
3. **Không mở rộng thành marketplace đa người bán** — đây là quyết định đã chốt sau khi cân nhắc rủi ro chicken-and-egg (cần cả cung lẫn cầu cùng lúc) và thiếu cơ chế ràng buộc giao dịch giữa người lạ với người lạ. Có thể xem xét lại **sau khi** mô hình đơn-người-bán được validate thành công.
4. **Không có app di động riêng** — trang web responsive là đủ cho quy mô một chiến dịch thanh lý.
5. **Không xây hệ thống chấm điểm uy tín tự động (reputation engine)** — ở v1, việc theo dõi SĐT từng bùng kèo sẽ làm thủ công; tự động hóa việc này để version sau nếu mô hình được nhân rộng.

---

## 4. User Stories

### Người bán (chủ trang — chính là người dùng hệ thống)
- Là người bán, tôi muốn **đăng sản phẩm thanh lý kèm giá khởi điểm, bước giá, và thời gian kết thúc**, để mỗi sản phẩm có một phiên đấu giá rõ ràng, có deadline tạo áp lực chốt.
- Là người bán, tôi muốn **hiển thị bằng chứng uy tín** (rating, số đơn đã bán từ sàn TMĐT cũ) ngay đầu trang, để tạo niềm tin với người mua lạ chưa biết đến tôi.
- Là người bán, tôi muốn **nhận thông báo khi có người thắng đấu giá**, kèm SĐT liên hệ, để tôi chủ động liên hệ chốt đơn.
- Là người bán, tôi muốn **đánh dấu sản phẩm đã bán/đã hủy** sau khi giao dịch xong hoặc người thắng bùng kèo, để trang phản ánh đúng tình trạng thực tế.
- Là người bán, tôi muốn **chia sẻ link riêng của từng sản phẩm** ra Facebook/Zalo, để tận dụng traffic từ bạn bè quan tâm đúng món đó thay vì cả trang.

### Người mua (không cần tài khoản)
- Là người mua, tôi muốn **xem danh sách sản phẩm đang thanh lý kèm ảnh, mô tả tình trạng, giá hiện tại**, để đánh giá có đáng mua không mà không cần đăng ký.
- Là người mua, tôi muốn **xem lịch sử trả giá công khai của sản phẩm**, để biết mức giá cạnh tranh thực tế và quyết định có nên trả giá cao hơn không.
- Là người mua, tôi muốn **nhập SĐT để trả giá**, để tham gia đấu giá mà không cần tạo tài khoản.
- Là người mua, tôi muốn **có lựa chọn "Mua ngay" với giá cố định cao hơn**, để chốt được sản phẩm ngay lập tức nếu không muốn chờ đấu giá kết thúc.
- Là người mua, tôi muốn **nhận thông báo nếu tôi thắng đấu giá**, kèm hướng dẫn liên hệ, để biết bước tiếp theo cần làm gì.

### Trường hợp biên
- Là người mua, khi tôi trả giá nhưng có người khác trả cao hơn ngay sau đó, tôi muốn **thấy rõ mình đã bị vượt giá**, để quyết định có trả tiếp không.
- Là người bán, khi phiên đấu giá kết thúc mà **không có ai trả giá**, tôi muốn hệ thống hiển thị rõ trạng thái "chưa bán", để tôi cân nhắc gia hạn hoặc đăng lại với giá khởi điểm thấp hơn.
- Là người bán, khi người thắng **không phản hồi trong thời gian quy định** (ví dụ 24h), tôi muốn hệ thống tự động chuyển quyền liên hệ sang người trả giá cao thứ nhì, để giảm thiểu rủi ro bùng kèo.

---

## 5. Requirements

### Must-Have (P0)

**P0.1 — Đăng sản phẩm thanh lý**
- Người bán đăng sản phẩm gồm: ảnh (tối thiểu 1, khuyến khích nhiều ảnh), tên, mô tả, tình trạng (mới/đã dùng/lỗi gì), giá khởi điểm, bước giá tối thiểu, thời gian kết thúc.
- *Acceptance criteria:*
  - [ ] Không thể đăng sản phẩm thiếu ảnh hoặc thiếu giá khởi điểm
  - [ ] Thời gian kết thúc phải ở tương lai, có thể chọn theo giờ/ngày cụ thể
  - [ ] Sản phẩm sau khi đăng hiển thị ngay trên trang danh sách công khai

**P0.2 — Đấu giá công khai với SĐT bắt buộc**
- Người mua nhập SĐT + mức giá muốn trả (phải ≥ giá hiện tại + bước giá tối thiểu).
- Lịch sử trả giá hiển thị công khai: mức giá, thời gian (SĐT được ẩn một phần, ví dụ 090***123).
- *Acceptance criteria:*
  - [ ] Given sản phẩm đang trong thời gian đấu giá, When người mua nhập SĐT và mức giá hợp lệ, Then giá hiện tại của sản phẩm cập nhật ngay và lịch sử trả giá hiển thị dòng mới
  - [ ] Given mức giá nhập vào thấp hơn (giá hiện tại + bước giá), When người mua bấm trả giá, Then hệ thống báo lỗi và không ghi nhận
  - [ ] SĐT không hiển thị đầy đủ trong lịch sử công khai, chỉ chủ trang thấy đầy đủ

**P0.3 — Kết thúc phiên đấu giá tự động**
- Khi hết thời gian, hệ thống tự khóa sản phẩm, xác định người thắng (giá cao nhất), hiển thị trạng thái "đã kết thúc — chờ liên hệ".
- *Acceptance criteria:*
  - [ ] Given thời gian kết thúc đã qua, When có người truy cập trang sản phẩm, Then không thể trả giá thêm, hệ thống hiển thị người thắng (SĐT ẩn một phần) và giá chốt
  - [ ] Given không có ai trả giá trong suốt phiên, When hết thời gian, Then trạng thái hiển thị "Chưa bán" thay vì "Đã kết thúc — chờ liên hệ"

**P0.4 — Trang quản lý cho người bán (đơn giản, không cần multi-user)**
- Xem danh sách tất cả sản phẩm đã đăng, trạng thái (đang đấu giá / chờ liên hệ / đã bán / chưa bán / đã hủy), người thắng và SĐT đầy đủ.
- *Acceptance criteria:*
  - [ ] Người bán đăng nhập bằng một tài khoản duy nhất (không cần hệ thống multi-tenant)
  - [ ] Có thể đánh dấu thủ công trạng thái "đã bán" hoặc "đã hủy" cho từng sản phẩm

**P0.5 — Bằng chứng uy tín trên trang chủ**
- Hiển thị: số sao đánh giá trung bình, số đơn đã bán, top vài review tốt (chụp/nhập tay từ sàn cũ), tất cả đặt ở đầu trang trước danh sách sản phẩm.
- *Acceptance criteria:*
  - [ ] Nội dung uy tín hiển thị cố định ở đầu trang chủ, không cần cuộn để thấy
  - [ ] Người bán có thể tự cập nhật nội dung này qua trang quản lý (không cần dev can thiệp)

### Nice-to-Have (P1)

**P1.1 — "Mua ngay" song song với đấu giá**
- Giá mua ngay cố định (cao hơn giá khởi điểm đáng kể), người mua chọn mua ngay sẽ kết thúc phiên đấu giá ngay lập tức.
- *Lý do P1:* tăng tốc độ chốt cho người mua vội, nhưng không phải điều kiện tiên quyết để mô hình đấu giá hoạt động.

**P1.2 — Chia sẻ sản phẩm ra mạng xã hội**
- Nút chia sẻ link riêng từng sản phẩm ra Facebook/Zalo kèm ảnh preview.
- *Lý do P1:* hỗ trợ tăng traffic nhưng người bán vẫn có thể copy link thủ công nếu chưa có tính năng này ở bản đầu.

**P1.3 — Xử lý người thắng không phản hồi**
- Nếu người thắng không xác nhận trong 24h (qua một cơ chế xác nhận đơn giản, ví dụ bấm link trong tin nhắn), hệ thống tự động chuyển sang người trả giá cao thứ nhì.
- *Lý do P1:* giảm rủi ro bùng kèo, nhưng ở quy mô nhỏ ban đầu người bán có thể xử lý thủ công qua gọi điện.

**P1.4 — Cảnh báo SĐT từng bùng kèo**
- Danh sách SĐT do người bán tự đánh dấu "đã bùng" ở các phiên trước, cảnh báo (không chặn cứng) khi SĐT đó trả giá lại.
- *Lý do P1:* hữu ích nhưng cần đủ dữ liệu tích lũy mới có giá trị, không cấp thiết ngay từ đầu.

### Future Considerations (P2)

**P2.1 — Mô hình marketplace đa người bán** — đã chốt là non-goal cho v1 (xem mục 3). Nếu theo đuổi sau này, cần thiết kế lại từ đầu: tài khoản người bán, xác thực danh tính, cơ chế ký quỹ/đặt cọc để ràng buộc giao dịch giữa người lạ với người lạ, và giải quyết bài toán chicken-and-egg. Ghi nhận ở đây để không vô tình thiết kế kiến trúc dữ liệu quá cứng nhắc cho một-người-bán, phòng khi cần mở rộng.

**P2.2 — Hệ thống chấm điểm uy tín tự động** — tự động tính điểm tin cậy người mua dựa trên lịch sử trả giá/thắng/hoàn tất giao dịch.

**P2.3 — Thanh toán/đặt cọc online** — nếu chiến dịch thanh lý sau này lặp lại thường xuyên, có thể cân nhắc tích hợp cổng thanh toán để giảm ma sát và rủi ro bùng kèo.

---

## 6. Success Metrics

### Leading Indicators (theo dõi hàng tuần)
| Chỉ số | Cách đo | Mục tiêu |
|---|---|---|
| Tỷ lệ sản phẩm có ít nhất 1 lượt trả giá | (Số SP có trả giá / Tổng SP đăng) | ≥60% trong tuần đầu |
| Số lượt trả giá trung bình mỗi sản phẩm | Tổng lượt trả giá / Tổng SP có đấu giá | ≥3 lượt/SP |
| Tỷ lệ chuyển đổi xem → trả giá | Số người để lại SĐT / Số lượt xem trang SP | ≥5% |

### Lagging Indicators (đánh giá sau 30 ngày — kết thúc chiến dịch)
| Chỉ số | Cách đo | Mục tiêu (Success) | Mục tiêu (Stretch) |
|---|---|---|---|
| Tỷ lệ hàng bán được | SP đã bán / Tổng SP đăng | 80% | 95% |
| Giá chốt trung bình so với giá gốc sàn | Trung bình (giá chốt/giá gốc) | 70% | 85% |
| Tỷ lệ hoàn tất giao dịch (không bùng) | SP giao dịch thành công / SP có người thắng | 85% | 95% |

**Thời điểm đánh giá:** ngày 7 (kiểm tra sớm để điều chỉnh nếu traffic quá thấp), ngày 30 (tổng kết cuối chiến dịch).

---

## 7. Open Questions

1. **[Người bán/Stakeholder]** Ngưỡng bước giá tối thiểu nên là số cố định (ví dụ 10.000đ) hay % theo giá hiện tại (ví dụ 5%)? Ảnh hưởng đến cả sản phẩm giá rẻ lẫn giá cao.
2. **[Người bán]** Nếu một sản phẩm hết giờ mà chỉ có 1 lượt trả giá duy nhất (bằng đúng giá khởi điểm), có nên tự động coi là "đã bán" hay cần xác nhận thủ công thêm bước nữa?
3. **[Engineering]** Cơ chế xác nhận người thắng trong 24h (P1.3) triển khai qua kênh nào khả thi nhất với chi phí thấp — SMS OTP, Zalo OA, hay chỉ cần gọi điện thủ công ở bản v1?
4. **[Người bán]** Có giới hạn số lượng sản phẩm đăng cùng lúc không, hay đăng hết một lần ngay từ đầu chiến dịch? Ảnh hưởng đến việc thiết kế trang danh sách (phân trang, lọc theo danh mục).
5. **[Legal — không chặn triển khai nhưng nên xác nhận sớm]** Việc hiển thị công khai lịch sử trả giá kèm SĐT (dù ẩn một phần) có cần thông báo/xin phép người dùng theo quy định bảo vệ dữ liệu cá nhân hiện hành không?

---

## 8. Timeline Considerations

- **Không có deadline cứng theo hợp đồng/mặt bằng** (dựa trên thông tin trao đổi) — nhưng nên đặt **mốc tự đặt 30 ngày** để tạo áp lực hoàn thành chiến dịch, tránh kéo dài vô thời hạn làm mất động lực người mua quay lại.
- **Phụ thuộc bên ngoài:** không có (không tích hợp bên thứ ba nào ở P0), giúp v1 có thể triển khai nhanh mà không chờ đối tác.
- **Phân kỳ đề xuất:**
  - **Tuần 1:** Xây và launch P0 (đăng sản phẩm, đấu giá, trang quản lý, bằng chứng uy tín).
  - **Tuần 1-2 (song song):** Thu thập bằng chứng uy tín từ sàn cũ, chuẩn bị danh sách sản phẩm, bắt đầu chia sẻ vào nhóm mua bán.
  - **Sau ngày 7:** Đánh giá leading indicators — nếu traffic/tỷ lệ trả giá thấp hơn kỳ vọng nhiều, cân nhắc bổ sung P1.1 (Mua ngay) sớm để tăng tốc độ chốt thay vì chờ đấu giá.
  - **Ngày 30:** Tổng kết, đóng chiến dịch.

---

## Ghi chú phạm vi (Parking Lot)

Các ý tưởng đã bàn nhưng cố tình để ngoài phạm vi v1, ghi lại để không quên:
- Mở rộng thành marketplace cho nhiều người bán khác dùng (xem mục P2.1).
- Chạy quảng cáo trả phí để tăng traffic — chưa cần thiết ở quy mô một chiến dịch cá nhân, chỉ cân nhắc nếu traffic tự nhiên quá thấp sau tuần 1.
