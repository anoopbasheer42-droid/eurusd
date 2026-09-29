
async function refreshDashboard() {
    const priceElement = document.getElementById("price");
    const trendElement = document.getElementById("trend");

    try {
        priceElement.innerText = "Loading...";

        const response = await fetch(
            "https://api.frankfurter.dev/v1/latest?base=EUR&symbols=USD"
        );

        if (!response.ok) {
            throw new Error("Price request failed");
        }

        const data = await response.json();
        const price = Number(data.rates.USD);

        priceElement.innerText = price.toFixed(5);

        trendElement.innerText =
            "EUR/USD reference rate connected • Updated: " +
            new Date().toLocaleTimeString();

    } catch (error) {
        console.error(error);

        priceElement.innerText = "Unavailable";
        trendElement.innerText =
            "Unable to load EUR/USD data";
    }
}

refreshDashboard();

setInterval(refreshDashboard, 30000);
