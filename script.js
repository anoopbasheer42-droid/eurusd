const API_KEY = "8908432b6c784bc49aad6ccf64845991";

async function refreshDashboard() {
    const priceElement = document.getElementById("price");
    const trendElement = document.getElementById("trend");

    try {
        priceElement.innerText = "Loading...";

        const response = await fetch(
            `https://api.twelvedata.com/price?symbol=EUR/USD&apikey=${API_KEY}`
        );

        const data = await response.json();

        if (data.status === "error") {
            throw new Error(data.message);
        }

        const price = Number(data.price);

        if (!Number.isFinite(price)) {
            throw new Error("Invalid price received");
        }

        priceElement.innerText = price.toFixed(5);

        trendElement.innerText =
            "Twelve Data connected • Updated: " +
            new Date().toLocaleTimeString();

    } catch (error) {
        console.error("Twelve Data error:", error);

        priceElement.innerText = "Unavailable";
        trendElement.innerText = "API connection error";
    }
}

refreshDashboard();

setInterval(refreshDashboard, 30000);
