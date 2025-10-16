// src/ChartComponent.jsx

import React from 'react';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, LineElement, PointElement, ArcElement, Title, Tooltip, Legend } from 'chart.js';
import { Bar, Line, Pie } from 'react-chartjs-2';

ChartJS.register( CategoryScale, LinearScale, BarElement, LineElement, PointElement, ArcElement, Title, Tooltip, Legend );

const formatDataForChart = (data, chartType) => {
    if (!data || data.length === 0) {
        return { labels: [], datasets: [] };
    }

    const labels = data.map(row => row[Object.keys(row)[0]]);
    let datasets = [];
    if (chartType === 'pie') {
        const dataPoints = data.map(row => row[Object.keys(row)[1]]);
        const backgroundColors = [];
        const borderColors = [];

        for (let i = 0; i < labels.length; i++) {
            const hue = (i * (360 / labels.length));
            backgroundColors.push(`hsl(${hue}, 85%, 65%)`);
            borderColors.push(`hsl(${hue}, 85%, 50%)`);
        }

        datasets.push({
            data: dataPoints,
            backgroundColor: backgroundColors,
            borderColor: borderColors,
            borderWidth: 1.5,
        });
    } 
    else {
        const dataKeys = Object.keys(data[0]).slice(1);
        datasets = dataKeys.map((key, index) => {
            const hue = (index * 70) % 360;
            return {
                label: key,
                data: data.map(row => row[key]),
                backgroundColor: `hsla(${hue}, 70%, 60%, 0.8)`,
                borderColor: `hsla(${hue}, 70%, 60%, 1)`,
                borderWidth: 1,
            };
        });
    }

    return { labels, datasets };
};

export default function ChartComponent({ chartInfo }) {
    const { chartType, title, data } = chartInfo;

    if (!data || data.length === 0) {
        return (
            <div className="chart-container">
                <h3>{title || 'Result'}</h3>
                <p className="no-data-message">No data found for this query.</p>
            </div>
        );
    }

    if (chartType === 'error' || chartType === 'single_value') {
        const message = data[0].error_message || JSON.stringify(data[0]);
        return <div className="chart-container error-message"><h3>{title}</h3><p>{message}</p></div>;
    }
    
    if (chartType === 'table') {
        return (
            <div className="chart-container">
                <h3>{title}</h3>
                <table>
                    <thead>
                        <tr>{Object.keys(data[0]).map(key => <th key={key}>{key}</th>)}</tr>
                    </thead>
                    <tbody>
                        {data.map((row, i) => <tr key={i}>{Object.values(row).map((val, j) => <td key={j}>{String(val)}</td>)}</tr>)}
                    </tbody>
                </table>
            </div>
        );
    }

    const formattedData = formatDataForChart(data, chartType);
    const options = {
        responsive: true,
        plugins: {
            legend: { position: 'top' },
            title: { display: true, text: title },
        },
    };
    
    return (
        <div className="chart-container">
            {chartType === 'bar' && <Bar options={options} data={formattedData} />}
            {chartType === 'line' && <Line options={options} data={formattedData} />}
            {chartType === 'pie' && <Pie options={options} data={formattedData} />}
        </div>
    );
}