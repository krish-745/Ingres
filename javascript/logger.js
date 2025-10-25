import winston from 'winston';
import 'winston-mongodb'; 

const options = {

  console: {
    level: 'debug',
    handleExceptions: true,
    json: false,
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple()
    ),
  },


  file: {
    level: 'info',
    filename: `./logs/app.log`,
    handleExceptions: true,
    json: true,
    maxsize: 5242880, 
    maxFiles: 5,
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.json()
    ),
  },
  errorFile: {
    level: 'error',
    filename: `./logs/error.log`,
    handleExceptions: true,
    json: true,
    maxsize: 5242880, 
    maxFiles: 5,
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.json()
    ),
  },
};

const logger = winston.createLogger({
  levels: winston.config.npm.levels,
  transports: [
    new winston.transports.File(options.file),
    new winston.transports.File(options.errorFile),
  ],
  exitOnError: false,
});

if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console(options.console));
}

logger.stream = {
  write: function (message, encoding) {
    logger.http(message.trim());
  },
};

export default logger;