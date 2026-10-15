/* ==========================================================
   destinasi.js
   Dipakai oleh gunung.html dan pantai.html (jenis dibaca dari
   atribut data-jenis pada <main>).

   Fitur:
   1. Daftar destinasi dimuat dinamis lewat AJAX (data/*.json)
   2. Pencarian + filter langsung tanpa reload halaman
   3. Modal detail dengan:
      - ulasan pengunjung  -> GET  dummyjson.com/comments
      - kirim ulasan       -> POST dummyjson.com/comments/add
      - cuaca saat ini     -> GET  api.open-meteo.com
   ========================================================== */
$(function () {
  'use strict';

  const $main = $('main[data-jenis]');
  if (!$main.length) return;

  const JENIS = $main.data('jenis');            // 'gunung' | 'pantai'
  const URL_DATA = 'data/' + JENIS + '.json';
  const URL_ULASAN = 'https://dummyjson.com/comments';
  const URL_CUACA = 'https://api.open-meteo.com/v1/forecast';

  const $tbody = $('#tabel-body');
  const $caption = $tbody.closest('table').find('caption');
  const jumlahKolom = $tbody.closest('table').find('thead th').length;
  const captionAwal = $caption.text();

  let semuaData = [];
  const cacheUlasan = {};   // id destinasi -> array ulasan
  let idTerbuka = null;     // id destinasi yang sedang tampil di modal

  /* ---------- Helper kecil ---------- */

  const angka = (n) => Number(n).toLocaleString('id-ID');
  const kapital = (s) => s.charAt(0).toUpperCase() + s.slice(1);

  function debounce(fn, jeda) {
    let t;
    return function () {
      const args = arguments;
      clearTimeout(t);
      t = setTimeout(() => fn.apply(null, args), jeda);
    };
  }

  /* Satu baris pesan (loading / kosong / error) yang melebar satu tabel */
  function barisPesan(teks, kelas, tombolUlang) {
    const $td = $('<td>').attr('colspan', jumlahKolom).addClass('status-muat ' + (kelas || ''));
    if (kelas === 'memuat') $td.append($('<span class="spinner" aria-hidden="true">'));
    $td.append($('<span>').text(teks));
    if (tombolUlang) {
      $td.append($('<button type="button" class="btn-ulang">Coba lagi</button>').on('click', muatData));
    }
    return $('<tr>').append($td);
  }

  /* ---------- 1. Memuat daftar lewat AJAX ---------- */

  function muatData() {
    $tbody.empty().append(barisPesan('Memuat daftar ' + JENIS + '...', 'memuat'));
    $('#info-sumber').remove();

    $.ajax({ url: URL_DATA, dataType: 'json', cache: false, timeout: 8000 })
      .done(function (data) {
        semuaData = data;
        terapkanFilter();
      })
      .fail(function () {
        /* Dibuka langsung dari file:// -> browser memblokir AJAX ke file lokal.
           Pakai data cadangan agar halaman tetap bisa dipakai. */
        const cadangan = window.DATA_CADANGAN && window.DATA_CADANGAN[JENIS];
        if (cadangan) {
          semuaData = cadangan;
          terapkanFilter();
          $('<p id="info-sumber" class="info-sumber">')
            .text('Data diambil dari cadangan lokal karena file JSON tidak bisa dimuat lewat AJAX. Jalankan lewat server lokal (misalnya Live Server) untuk memuat dari data/' + JENIS + '.json.')
            .insertBefore($tbody.closest('table'));
        } else {
          $tbody.empty().append(barisPesan('Gagal memuat data. Periksa koneksi lalu coba lagi.', 'galat', true));
        }
      });
  }

  /* ---------- 2. Render + filter ---------- */

  function render(daftar) {
    $tbody.empty();

    if (!daftar.length) {
      $tbody.append(barisPesan('Tidak ada ' + JENIS + ' yang cocok dengan pencarian.', 'kosong'));
      return;
    }

    daftar.forEach(function (d, i) {
      const $tr = $('<tr>').append($('<th scope="row">').text(i + 1));
      $tr.append($('<td>').text(d.nama));
      $tr.append($('<td>').text(d.lokasi));

      if (JENIS === 'gunung') {
        $tr.append($('<td>').text(angka(d.ketinggian) + ' mdpl'));
        $tr.append($('<td>').text('± ' + d.jarak + ' km'));
        $tr.append($('<td>').text(kapital(d.tingkat)));
      } else {
        $tr.append($('<td>').text('± ' + d.jarak + ' km'));
        $tr.append($('<td>').text(d.keunggulan));
      }

      const $aksi = $('<td>');
      $aksi.append($('<a class="btn-detail">').attr({ href: 'detail-' + JENIS + '.html', 'data-id': d.id }).text('Detail'));
      $aksi.append(' | ');
      $aksi.append($('<a>').attr('href', 'form-destinasi.html').text('Edit'));
      $tr.append($aksi);

      $tbody.append($tr);
    });
  }

  function terapkanFilter() {
    const kata = $.trim($('input[type="search"]').val()).toLowerCase();
    const hasil = semuaData.filter(function (d) {
      if (kata && d.nama.toLowerCase().indexOf(kata) === -1) return false;
      if (JENIS === 'gunung') {
        const tingkat = $('input[name="tingkat"]:checked').val();
        if (tingkat && d.tingkat !== tingkat) return false;
      } else {
        const kab = $('#kabupaten-pantai').val();
        if (kab && d.kabupaten !== kab) return false;
      }
      return true;
    });

    render(hasil);
    $caption.text('Menampilkan ' + hasil.length + ' dari ' + semuaData.length + ' destinasi. ' + captionAwal);
  }

  const terapkanFilterTunda = debounce(terapkanFilter, 250);

  $('input[type="search"]').on('input', terapkanFilterTunda);
  $('input[name="tingkat"], #kabupaten-pantai').on('change', terapkanFilter);
  $('form[action="#"][method="get"]').on('submit', function (e) {
    e.preventDefault();
    terapkanFilter();
  });

  /* ---------- 3. Modal detail ---------- */

  const $modal = $(
    '<div class="modal" id="modal" hidden>' +
      '<div class="modal-kotak" role="dialog" aria-modal="true" aria-labelledby="modal-judul" tabindex="-1">' +
        '<button type="button" class="modal-tutup" aria-label="Tutup detail">&times;</button>' +
        '<h3 id="modal-judul"></h3>' +
        '<p class="modal-lokasi"></p>' +
        '<dl class="modal-info"></dl>' +
        '<p class="modal-deskripsi"></p>' +
        '<p class="modal-cuaca" aria-live="polite"></p>' +
        '<h4>Ulasan Pengunjung</h4>' +
        '<ul class="modal-ulasan" aria-live="polite"></ul>' +
        '<form class="form-ulasan">' +
          '<label for="isi-ulasan">Tulis ulasan</label>' +
          '<textarea id="isi-ulasan" rows="2" maxlength="200" required placeholder="Bagaimana pengalamanmu di sini?"></textarea>' +
          '<button type="submit">Kirim ulasan</button>' +
          '<span class="status-kirim" role="status"></span>' +
        '</form>' +
        '<p class="catatan-api">Ulasan dan cuaca dimuat dari API publik (dummyjson.com dan open-meteo.com). Isi ulasan hanya contoh.</p>' +
      '</div>' +
    '</div>'
  ).appendTo('body');

  const $kotak = $modal.find('.modal-kotak');
  let pemicu = null;   // elemen yang membuka modal, untuk mengembalikan fokus

  function buka(d, elemenPemicu) {
    idTerbuka = d.id;
    pemicu = elemenPemicu;

    $modal.find('#modal-judul').text(d.nama);
    $modal.find('.modal-lokasi').text(d.lokasi);
    $modal.find('.modal-deskripsi').text(d.deskripsi);
    $modal.find('.status-kirim').text('');
    $modal.find('#isi-ulasan').val('');

    const info = [['Jarak dari Bandung', '± ' + d.jarak + ' km']];
    if (JENIS === 'gunung') {
      info.unshift(['Tingkat kesulitan', kapital(d.tingkat)]);
      info.unshift(['Ketinggian', angka(d.ketinggian) + ' mdpl']);
    } else {
      info.unshift(['Keunggulan', d.keunggulan]);
    }
    const $dl = $modal.find('.modal-info').empty();
    info.forEach(function (baris) {
      $dl.append($('<dt>').text(baris[0]), $('<dd>').text(baris[1]));
    });

    $modal.prop('hidden', false);
    $('body').addClass('modal-terbuka');
    $kotak.trigger('focus');

    muatCuaca(d);
    muatUlasan(d);
  }

  function tutup() {
    idTerbuka = null;
    $modal.prop('hidden', true);
    $('body').removeClass('modal-terbuka');
    if (pemicu) $(pemicu).trigger('focus');
  }

  $(document).on('click', '.btn-detail', function (e) {
    e.preventDefault();
    const id = Number($(this).data('id'));
    const d = semuaData.find(function (x) { return x.id === id; });
    if (d) buka(d, this);
  });

  $modal.on('click', function (e) { if (e.target === this) tutup(); });
  $modal.on('click', '.modal-tutup', tutup);

  $(document).on('keydown', function (e) {
    if ($modal.prop('hidden')) return;
    if (e.key === 'Escape') { tutup(); return; }
    if (e.key === 'Tab') {            // fokus tidak keluar dari modal
      const $fokus = $kotak.find('button, textarea, a[href]').filter(':visible');
      const awal = $fokus.first()[0];
      const akhir = $fokus.last()[0];
      if (e.shiftKey && (document.activeElement === awal || document.activeElement === $kotak[0])) {
        e.preventDefault(); akhir.focus();
      } else if (!e.shiftKey && document.activeElement === akhir) {
        e.preventDefault(); awal.focus();
      }
    }
  });

  /* ---------- Ulasan: GET dan POST ke dummyjson.com ---------- */

  function tambahUlasan(u, baru) {
    const nama = (u.user && (u.user.fullName || u.user.username)) || 'Pengunjung';
    const $li = $('<li>').toggleClass('ulasan-baru', !!baru);
    $li.append($('<strong>').text(nama));
    $li.append($('<span>').text(u.body));
    $modal.find('.modal-ulasan').append($li);
  }

  function muatUlasan(d) {
    const $ul = $modal.find('.modal-ulasan').empty();

    if (cacheUlasan[d.id]) {
      cacheUlasan[d.id].forEach(function (u) { tambahUlasan(u); });
      return;
    }

    $ul.append($('<li class="ulasan-status">').text('Memuat ulasan...'));

    $.getJSON(URL_ULASAN, { limit: 3, skip: (d.id - 1) * 3 })
      .done(function (res) {
        cacheUlasan[d.id] = res.comments || [];
        if (idTerbuka !== d.id) return;        // modal sudah ditutup / ganti destinasi
        $ul.empty();
        if (!cacheUlasan[d.id].length) {
          $ul.append($('<li class="ulasan-status">').text('Belum ada ulasan.'));
        }
        cacheUlasan[d.id].forEach(function (u) { tambahUlasan(u); });
      })
      .fail(function () {
        if (idTerbuka !== d.id) return;
        $ul.empty().append($('<li class="ulasan-status">').text('Ulasan tidak bisa dimuat saat ini.'));
      });
  }

  $modal.find('.form-ulasan').on('submit', function (e) {
    e.preventDefault();
    const isi = $.trim($('#isi-ulasan').val());
    if (!isi || idTerbuka === null) return;

    const idKirim = idTerbuka;
    const $tombol = $(this).find('button').prop('disabled', true);
    const $status = $(this).find('.status-kirim').text('Mengirim...');

    $.ajax({
      url: URL_ULASAN + '/add',
      method: 'POST',
      contentType: 'application/json',
      data: JSON.stringify({ body: isi, postId: idKirim, userId: 1 })
    })
      .done(function (res) {
        /* dummyjson hanya mensimulasikan: data tidak benar-benar tersimpan,
           jadi kita simpan sendiri di cache untuk sesi ini. */
        const ulasan = { body: res.body || isi, user: { fullName: 'Kamu' } };
        (cacheUlasan[idKirim] = cacheUlasan[idKirim] || []).push(ulasan);
        if (idTerbuka === idKirim) {
          $modal.find('.ulasan-status').remove();
          tambahUlasan(ulasan, true);
          $('#isi-ulasan').val('');
          $status.text('Ulasan terkirim.');
        }
      })
      .fail(function () { $status.text('Gagal mengirim ulasan. Coba lagi.'); })
      .always(function () { $tombol.prop('disabled', false); });
  });

  /* ---------- Cuaca: open-meteo.com ---------- */

  function teksCuaca(kode) {
    if (kode === 0) return 'Cerah';
    if (kode <= 3) return 'Berawan';
    if (kode === 45 || kode === 48) return 'Berkabut';
    if (kode >= 51 && kode <= 57) return 'Gerimis';
    if (kode >= 61 && kode <= 67) return 'Hujan';
    if (kode >= 80 && kode <= 82) return 'Hujan lebat';
    if (kode >= 95) return 'Badai petir';
    return 'Tidak diketahui';
  }

  function muatCuaca(d) {
    const $cuaca = $modal.find('.modal-cuaca').text('Memuat cuaca...');

    $.getJSON(URL_CUACA, {
      latitude: d.lat,
      longitude: d.lon,
      current: 'temperature_2m,weather_code',
      timezone: 'Asia/Jakarta'
    })
      .done(function (res) {
        if (idTerbuka !== d.id) return;
        const c = res.current;
        $cuaca.text('Cuaca saat ini: ' + Math.round(c.temperature_2m) + '°C, ' + teksCuaca(c.weather_code));
      })
      .fail(function () {
        if (idTerbuka === d.id) $cuaca.text('');   // cuaca hanya tambahan, gagal pun tidak perlu mengganggu
      });
  }

  /* ---------- Mulai ---------- */
  muatData();
});
