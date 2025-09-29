// ------------------------
// AIRPORT SERVICES PAGE
// ------------------------
document.addEventListener("DOMContentLoaded", () => {
  // Airport services total calculation
  const airportCheckboxes = document.querySelectorAll('#airportForm input[name="services"]');
  const totalSpanAirport = document.querySelector('#airportForm #total');

  if (airportCheckboxes.length > 0) {
    airportCheckboxes.forEach(cb => {
      cb.addEventListener('change', () => {
        let total = 0;
        airportCheckboxes.forEach(c => {
          if (c.checked) total += parseInt(c.dataset.price);
        });
        totalSpanAirport.textContent = total;
      });
    });
  }

  // Railway services total calculation
  const railwayCheckboxes = document.querySelectorAll('#railwayForm input[name="services"]');
  const totalSpanRailway = document.querySelector('#railwayForm #total');

  if (railwayCheckboxes.length > 0) {
    railwayCheckboxes.forEach(cb => {
      cb.addEventListener('change', () => {
        let total = 0;
        railwayCheckboxes.forEach(c => {
          if (c.checked) total += parseInt(c.dataset.price);
        });
        totalSpanRailway.textContent = total;
      });
    });
  }

  // ------------------------
  // BILL SUMMARY PAGE
  // ------------------------
  if (window.location.pathname.includes("bill_summary.html")) {
    const services = JSON.parse(localStorage.getItem('selectedServices')) || [];
    const journey = JSON.parse(localStorage.getItem('journeyData')) || {};
    const total = localStorage.getItem('totalAmount') || 0;

    const serviceList = document.getElementById('serviceList');
    services.forEach(s => {
      const li = document.createElement('li');
      li.textContent = s;
      serviceList.appendChild(li);
    });

    const journeyList = document.getElementById('journeyList');
    for (const [key, value] of Object.entries(journey)) {
      const li = document.createElement('li');
      li.textContent = `${key.charAt(0).toUpperCase() + key.slice(1)}: ${value}`;
      journeyList.appendChild(li);
    }

    document.getElementById('totalAmount').textContent = total;
  }

  // ------------------------
  // TICKET PAGE
  // ------------------------
  if (window.location.pathname.includes("ticket.html")) {
    const journey = JSON.parse(localStorage.getItem('journeyData')) || {};
    const services = JSON.parse(localStorage.getItem('selectedServices')) || [];
    const total = localStorage.getItem('totalAmount') || 0;

    document.getElementById('ticketName').textContent = journey.name || "";
    document.getElementById('ticketPhone').textContent = journey.phone || "";
    document.getElementById('ticketEmail').textContent = journey.email || "";
    document.getElementById('ticketType').textContent = journey.flight_train.toLowerCase().includes("air") ? "Airport" : "Railway";
    document.getElementById('ticketDate').textContent = journey.date || "";
    document.getElementById('ticketTime').textContent = journey.time || "";
    document.getElementById('ticketFlightTrain').textContent = journey.flight_train || "";
    document.getElementById('ticketStation').textContent = journey.station || "";

    const servicesList = document.getElementById('ticketServices');
    services.forEach(s => {
      const li = document.createElement('li');
      li.textContent = s;
      servicesList.appendChild(li);
    });

    document.getElementById('ticketTotal').textContent = total;

    // Generate QR Code
    const qrData = `Name:${journey.name}, Phone:${journey.phone}, Type:${journey.flight_train}, Date:${journey.date}, Station:${journey.station}, Total:₹${total}`;
    if (window.QRCode) {
      QRCode.toCanvas(document.getElementById('qrcode'), qrData, { width: 150 }, function (error) {
        if (error) console.error(error);
      });
    }
  }
});

// ------------------------
// PROCEED TO JOURNEY PAGES
// ------------------------
function proceedToJourneyAirport() {
  const selectedServices = [];
  const checkboxes = document.querySelectorAll('#airportForm input[name="services"]:checked');
  let total = 0;
  checkboxes.forEach(cb => {
    selectedServices.push(cb.value);
    total += parseInt(cb.dataset.price);
  });

  localStorage.setItem('selectedServices', JSON.stringify(selectedServices));
  localStorage.setItem('totalAmount', total);
  window.location.href = "journey_selection.html";
}

function proceedToJourneyRailway() {
  const selectedServices = [];
  const checkboxes = document.querySelectorAll('#railwayForm input[name="services"]:checked');
  let total = 0;
  checkboxes.forEach(cb => {
    selectedServices.push(cb.value);
    total += parseInt(cb.dataset.price);
  });

  localStorage.setItem('selectedServices', JSON.stringify(selectedServices));
  localStorage.setItem('totalAmount', total);
  window.location.href = "journey_selection.html";
}

// ------------------------
// JOURNEY SELECTION PAGE
// ------------------------
function proceedToBill() {
  const name = document.getElementById('name').value.trim();
  const phone = document.getElementById('phone').value.trim();
  const email = document.getElementById('email').value.trim();
  const date = document.getElementById('date').value;
  const time = document.getElementById('time').value;
  const flight_train = document.getElementById('flight_train').value.trim();
  const station = document.getElementById('station').value;
  const child = document.getElementById('child').checked;
  const wheelchair = document.getElementById('wheelchair').checked;
  const health = document.getElementById('health').checked;

  if (!name || !phone || !email || !date || !time || !flight_train || !station) {
    alert("Please fill all required fields.");
    return;
  }

  const journeyData = {
    name, phone, email, date, time, flight_train, station, child, wheelchair, health
  };

  localStorage.setItem('journeyData', JSON.stringify(journeyData));
  window.location.href = "bill_summary.html";
}

// ------------------------
// BILL SUMMARY PAGE
// ------------------------
function proceedToPayment() {
  window.location.href = "payment.html";
}

// ------------------------
// STRIPE PAYMENT PAGE
// ------------------------
if (window.location.pathname.includes("payment.html")) {
  document.addEventListener("DOMContentLoaded", async () => {
    const total = localStorage.getItem('totalAmount') || 0;
    document.getElementById('paymentAmount').textContent = total;

    const stripe = Stripe("pk_test_51RVEET05nKuppbvMKaHJRBfShiFs7WK3ixNp1Lzkqpm95AkSGpxnsTPKCcj1rJTJrr8fe0aWX7jc8NgZVb7BlSaz00DgLZK5tx");
    const elements = stripe.elements();
    const card = elements.create("card", { style: { base: { fontSize: '16px', color: '#1E90FF' } } });
    card.mount("#card-element");

    const payButton = document.getElementById("payButton");
    const paymentMessage = document.getElementById("paymentMessage");

    payButton.addEventListener("click", async () => {
      payButton.disabled = true;
      paymentMessage.textContent = "Processing payment...";

      try {
        const res = await fetch("http://localhost:5000/create-payment-intent", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ amount: total })
        });
        const data = await res.json();

        if (data.error) {
          paymentMessage.textContent = data.error;
          payButton.disabled = false;
          return;
        }

        const clientSecret = data.clientSecret;
        const result = await stripe.confirmCardPayment(clientSecret, { payment_method: { card } });

        if (result.error) {
          paymentMessage.textContent = result.error.message;
          payButton.disabled = false;
        } else if (result.paymentIntent.status === "succeeded") {
          paymentMessage.style.color = "green";
          paymentMessage.textContent = "Payment successful! Redirecting to ticket...";
          saveBooking();
        }
      } catch (err) {
        paymentMessage.textContent = "Payment failed. Try again.";
        payButton.disabled = false;
      }
    });
  });
}

// Save booking to backend after successful payment
async function saveBooking() {
  const services = JSON.parse(localStorage.getItem('selectedServices')) || [];
  const journey = JSON.parse(localStorage.getItem('journeyData')) || {};
  const total = localStorage.getItem('totalAmount') || 0;

  const bookingData = {
    user_id: null,
    type: journey.flight_train.toLowerCase().includes("air") ? "Airport" : "Railway",
    name: journey.name,
    phone: journey.phone,
    email: journey.email,
    date: journey.date,
    time: journey.time,
    flight_train: journey.flight_train,
    station: journey.station,
    services: services,
    total_amount: total
  };

  try {
    const res = await fetch("http://localhost:5000/bookings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(bookingData)
    });
    const data = await res.json();
    if (data.status === "success") {
      localStorage.setItem("bookingId", data.booking_id);
      setTimeout(() => {
        window.location.href = "ticket.html";
      }, 1500);
    } else {
      alert("Booking failed: " + data.message);
    }
  } catch (err) {
    alert("Error saving booking.");
  }
}

// ------------------------
// TICKET PDF DOWNLOAD
// ------------------------
function downloadPDF() {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  const ticket = document.getElementById('ticket');

  doc.html(ticket, {
    callback: function (doc) {
      doc.save("TravelAssist_MTicket.pdf");
    },
    x: 10,
    y: 10,
    html2canvas: { scale: 0.57 }
  });
}
