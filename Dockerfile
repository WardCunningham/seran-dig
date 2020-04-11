FROM docker.pkg.github.com/wardcunningham/seran-wiki/seran-wiki:latest
RUN apk add --update graphviz font-bitstream-type1 ghostscript-fonts && rm -rf /var/cache/apk/*
ADD . /seran-dig
CMD ["--port=80:8000", "../seran-dig/dig.ts"]
