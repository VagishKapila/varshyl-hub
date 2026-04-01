import { Bar } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

export const BarChart = ({ labels, datasets, stacked = false }) => {
  const data = {
    labels,
    datasets: datasets.map((ds) => ({
      label: ds.label,
      data: ds.data,
      backgroundColor: ds.color || '#6366f1',
    })),
  };

  const options = {
    indexAxis: 'x',
    responsive: true,
    maintainAspectRatio: true,
    plugins: {
      legend: {
        display: datasets.length > 1,
      },
    },
    scales: {
      x: {
        stacked: stacked,
        grid: {
          display: false,
        },
      },
      y: {
        stacked: stacked,
        beginAtZero: true,
        grid: {
          color: 'rgba(0,0,0,0.05)',
        },
      },
    },
  };

  return <Bar data={data} options={options} height={250} />;
};
